import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import {
  ConcurrencyConflictException,
  ServiceUnavailableException,
} from '@/common/exceptions';
import type { IdempotencyConfig } from '@/config';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';
import type {
  AcquireIdempotencyResult,
  IdempotencyRecord,
  IdempotencyResult,
  IdempotencyStore,
} from './idempotency-store.interface';

const SAVE_RESULT_LUA_SCRIPT = `
local raw = redis.call('get', KEYS[1])
if not raw then return 0 end
local current = cjson.decode(raw)
if current.ownerToken ~= ARGV[1] or current.state ~= 'PROCESSING' then return 0 end
current.state = 'COMPLETED'
current.statusCode = tonumber(ARGV[2])
current.responseBody = cjson.decode(ARGV[3])
current.headers = cjson.decode(ARGV[4])
current.expiresAt = ARGV[5]
redis.call('set', KEYS[1], cjson.encode(current), 'EX', ARGV[6])
return 1
`;

const MARK_FAILED_LUA_SCRIPT = `
local raw = redis.call('get', KEYS[1])
if not raw then return 0 end
local current = cjson.decode(raw)
if current.ownerToken ~= ARGV[1] or current.state ~= 'PROCESSING' then return 0 end
return redis.call('del', KEYS[1])
`;

@Injectable()
export class RedisIdempotencyStore implements IdempotencyStore {
  private readonly logger = new Logger(RedisIdempotencyStore.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | null,
    private readonly configService: ConfigService,
  ) {}

  async acquire(
    key: string,
    requestHash: string,
    ttlSeconds: number,
  ): Promise<AcquireIdempotencyResult> {
    const ownerToken = randomUUID();
    if (!this.redisClient)
      return this.handleAcquireFailure(
        key,
        new Error('Redis client is unavailable'),
        ownerToken,
      );

    const redisKey = key;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const record: IdempotencyRecord = {
      key,
      requestHash,
      state: 'PROCESSING',
      ownerToken,
      createdAt: now,
      expiresAt,
    };

    const serialized = JSON.stringify(record);

    try {
      const result = await this.redisClient.set(
        redisKey,
        serialized,
        'EX',
        ttlSeconds,
        'NX',
      );

      if (result === 'OK') {
        return { acquired: true, ownerToken };
      }

      const existingRaw = await this.redisClient.get(redisKey);
      if (!existingRaw) {
        const retry = await this.redisClient.set(
          redisKey,
          serialized,
          'EX',
          ttlSeconds,
          'NX',
        );
        if (retry === 'OK') return { acquired: true, ownerToken };
        throw new Error('Idempotency record changed while acquiring lease');
      }

      const existingRecord = JSON.parse(existingRaw) as IdempotencyRecord;
      return {
        acquired: false,
        existingRecord,
      };
    } catch (error: unknown) {
      return this.handleAcquireFailure(key, error, ownerToken);
    }
  }

  async saveResult(
    key: string,
    ownerToken: string,
    result: IdempotencyResult,
    ttlSeconds: number,
  ): Promise<void> {
    this.assertResponseSize(result);
    if (!this.redisClient)
      return this.handleMutationFailure(
        key,
        'saveResult',
        new Error('Redis client is unavailable'),
      );

    const redisKey = key;

    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      const updated = await this.redisClient.eval(
        SAVE_RESULT_LUA_SCRIPT,
        1,
        redisKey,
        ownerToken,
        String(result.statusCode),
        JSON.stringify(result.responseBody ?? null),
        JSON.stringify(result.headers ?? null),
        expiresAt,
        String(ttlSeconds),
      );
      if (Number(updated) !== 1) {
        this.logger.warn({
          message: 'Idempotency result rejected after lease ownership loss',
          storageKey: key,
          operation: 'saveResult',
        });
        throw new ConcurrencyConflictException({
          resource: key,
          message: 'Idempotency processing lease is no longer owned',
        });
      }
    } catch (error: unknown) {
      if (error instanceof ConcurrencyConflictException) throw error;
      return this.handleMutationFailure(key, 'saveResult', error);
    }
  }

  async markFailed(key: string, ownerToken: string): Promise<void> {
    if (!this.redisClient)
      return this.handleMutationFailure(
        key,
        'markFailed',
        new Error('Redis client is unavailable'),
      );

    const redisKey = key;

    try {
      const deleted = await this.redisClient.eval(
        MARK_FAILED_LUA_SCRIPT,
        1,
        redisKey,
        ownerToken,
      );
      if (Number(deleted) !== 1) {
        this.logger.warn({
          message: 'Idempotency failure marker ignored after ownership loss',
          storageKey: key,
          operation: 'markFailed',
        });
      }
    } catch (error: unknown) {
      return this.handleMutationFailure(key, 'markFailed', error);
    }
  }

  private handleAcquireFailure(
    key: string,
    error: unknown,
    ownerToken: string,
  ): AcquireIdempotencyResult {
    if (this.failureMode() === 'open') {
      this.logger.warn({
        message: 'Idempotency store unavailable; request allowed by open mode',
        storageKey: key,
        operation: 'acquire',
      });
      return { acquired: true, ownerToken };
    }
    throw this.unavailable(error);
  }

  private handleMutationFailure(
    key: string,
    operation: string,
    error: unknown,
  ): void {
    if (this.failureMode() === 'open') {
      this.logger.warn({
        message: 'Idempotency store mutation failed in open mode',
        storageKey: key,
        operation,
      });
      return;
    }
    throw this.unavailable(error);
  }

  private failureMode(): IdempotencyConfig['failureMode'] {
    return (
      this.configService.get<IdempotencyConfig>('idempotency')?.failureMode ??
      'closed'
    );
  }

  private assertResponseSize(result: IdempotencyResult): void {
    const maxResponseBytes =
      this.configService.get<IdempotencyConfig>('idempotency')
        ?.maxResponseBytes ?? 1_048_576;
    const bytes = Buffer.byteLength(JSON.stringify(result), 'utf8');
    if (bytes > maxResponseBytes) {
      throw new ServiceUnavailableException({
        code: 'IDEMPOTENCY_RESPONSE_TOO_LARGE',
        service: 'idempotency',
        message: 'Idempotent response exceeds the configured storage limit',
        details: { maxResponseBytes },
      });
    }
  }

  private unavailable(cause: unknown): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'IDEMPOTENCY_STORE_UNAVAILABLE',
      service: 'idempotency',
      message: 'Idempotency protection is temporarily unavailable',
      cause,
    });
  }
}
