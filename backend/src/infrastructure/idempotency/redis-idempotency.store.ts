import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';
import type {
  AcquireIdempotencyResult,
  IdempotencyRecord,
  IdempotencyStore,
} from './idempotency-store.interface';

@Injectable()
export class RedisIdempotencyStore implements IdempotencyStore {
  private readonly logger = new Logger(RedisIdempotencyStore.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | null,
  ) {}

  async acquire(
    key: string,
    requestHash: string,
    ttlSeconds: number,
  ): Promise<AcquireIdempotencyResult> {
    if (!this.redisClient) {
      return { acquired: true };
    }

    const redisKey = `idempotency:${key}`;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const record: IdempotencyRecord = {
      key,
      requestHash,
      state: 'PROCESSING',
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
        return { acquired: true };
      }

      const existingRaw = await this.redisClient.get(redisKey);
      if (!existingRaw) {
        // Edge case: expired right after NX check
        return { acquired: true };
      }

      const existingRecord = JSON.parse(existingRaw) as IdempotencyRecord;
      return {
        acquired: false,
        existingRecord,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown Redis error';
      this.logger.warn(`Idempotency acquire error for [${key}]: ${message}`);
      return { acquired: true };
    }
  }

  async saveResult(
    key: string,
    result: {
      statusCode: number;
      responseBody: unknown;
      headers?: Record<string, string>;
    },
    ttlSeconds: number,
  ): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    const redisKey = `idempotency:${key}`;

    try {
      const existingRaw = await this.redisClient.get(redisKey);
      let requestHash = '';
      let createdAt = new Date().toISOString();

      if (existingRaw) {
        try {
          const parsed = JSON.parse(existingRaw) as IdempotencyRecord;
          requestHash = parsed.requestHash;
          createdAt = parsed.createdAt;
        } catch {
          // fallback
        }
      }

      const record: IdempotencyRecord = {
        key,
        requestHash,
        state: 'COMPLETED',
        statusCode: result.statusCode,
        responseBody: result.responseBody,
        headers: result.headers,
        createdAt,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      };

      await this.redisClient.set(
        redisKey,
        JSON.stringify(record),
        'EX',
        ttlSeconds,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown Redis error';
      this.logger.warn(`Idempotency saveResult error for [${key}]: ${message}`);
    }
  }

  async markFailed(key: string): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    const redisKey = `idempotency:${key}`;

    try {
      await this.redisClient.del(redisKey);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown Redis error';
      this.logger.warn(`Idempotency markFailed error for [${key}]: ${message}`);
    }
  }
}
