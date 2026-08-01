import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import type { RedisConfig } from '@/config';
import { MetricsService } from '@/infrastructure/observability';
import type { CacheStore } from './cache-store.interface';
import { REDIS_CLIENT } from './redis/redis.constants';

@Injectable()
export class RedisCacheAdapter implements CacheStore {
  private readonly logger = new Logger(RedisCacheAdapter.name);
  private readonly defaultTtlSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | null,
    configService: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    const redisConfig = configService.get<RedisConfig>('redis');
    this.defaultTtlSeconds = redisConfig?.cacheDefaultTtlSeconds ?? 300;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redisClient) {
      this.metrics.recordCache('get', 'disabled');
      return null;
    }

    try {
      const raw = await this.redisClient.get(key);
      if (!raw) {
        this.metrics.recordCache('get', 'miss');
        return null;
      }
      this.metrics.recordCache('get', 'hit');
      return this.deserialize<T>(raw);
    } catch (error: unknown) {
      this.metrics.recordCache('get', 'failed');
      this.metrics.recordRedisError('cache');
      this.logFailure('get', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.redisClient) {
      this.metrics.recordCache('set', 'disabled');
      return;
    }

    const ttl = ttlSeconds ?? this.defaultTtlSeconds;

    try {
      const serialized = this.serialize(value);
      if (ttl > 0) {
        await this.redisClient.set(key, serialized, 'EX', ttl);
      } else {
        await this.redisClient.set(key, serialized);
      }
      this.metrics.recordCache('set', 'success');
    } catch (error: unknown) {
      this.metrics.recordCache('set', 'failed');
      this.metrics.recordRedisError('cache');
      this.logFailure('set', error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.redisClient) {
      this.metrics.recordCache('delete', 'disabled');
      return;
    }

    try {
      await this.redisClient.del(key);
      this.metrics.recordCache('delete', 'success');
    } catch (error: unknown) {
      this.metrics.recordCache('delete', 'failed');
      this.metrics.recordRedisError('cache');
      this.logFailure('delete', error);
    }
  }

  async deleteMany(keys: readonly string[]): Promise<void> {
    if (!this.redisClient || keys.length === 0) {
      if (!this.redisClient)
        this.metrics.recordCache('delete_many', 'disabled');
      return;
    }

    try {
      await this.redisClient.del(...keys);
      this.metrics.recordCache('delete_many', 'success');
    } catch (error: unknown) {
      this.metrics.recordCache('delete_many', 'failed');
      this.metrics.recordRedisError('cache');
      this.logFailure('delete_many', error);
    }
  }

  private serialize<T>(value: T): string {
    const wrapper = {
      v: 1,
      data: value,
    };

    return JSON.stringify(wrapper, (_key, val: unknown) => {
      if (typeof val === 'bigint') {
        return { __type: 'BigInt', value: val.toString() };
      }
      if (
        val &&
        typeof val === 'object' &&
        ('isDecimal' in val || '_isDecimal' in val)
      ) {
        const decVal = val as { toString?: () => string };
        return {
          __type: 'Decimal',
          value: typeof decVal.toString === 'function' ? decVal.toString() : '',
        };
      }
      return val;
    });
  }

  private deserialize<T>(raw: string): T | null {
    try {
      const parsed = JSON.parse(raw, (_key, val: unknown) => {
        if (
          val &&
          typeof val === 'object' &&
          '__type' in val &&
          'value' in val &&
          typeof (val as { value: unknown }).value === 'string'
        ) {
          const typedVal = val as { __type: string; value: string };
          if (typedVal.__type === 'BigInt') {
            return BigInt(typedVal.value);
          }
          if (typedVal.__type === 'Decimal') {
            return typedVal.value;
          }
        }
        return val;
      }) as { v?: number; data?: T };

      if (
        parsed &&
        typeof parsed === 'object' &&
        'v' in parsed &&
        'data' in parsed
      ) {
        return parsed.data ?? null;
      }
      return (parsed as unknown as T) ?? null;
    } catch {
      return null;
    }
  }

  private logFailure(operation: string, error: unknown): void {
    this.logger.warn({
      event: 'cache.operation.failed',
      operation,
      'error.type': error instanceof Error ? error.name : 'UnknownError',
    });
  }
}
