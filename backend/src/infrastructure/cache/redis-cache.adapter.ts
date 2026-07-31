import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import type { RedisConfig } from '@/config';
import type { CacheStore } from './cache-store.interface';
import { REDIS_CLIENT } from './redis/redis.constants';

@Injectable()
export class RedisCacheAdapter implements CacheStore {
  private readonly logger = new Logger(RedisCacheAdapter.name);
  private readonly defaultTtlSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | null,
    configService: ConfigService,
  ) {
    const redisConfig = configService.get<RedisConfig>('redis');
    this.defaultTtlSeconds = redisConfig?.cacheDefaultTtlSeconds ?? 300;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redisClient) {
      return null;
    }

    try {
      const raw = await this.redisClient.get(key);
      if (!raw) {
        return null;
      }
      return this.deserialize<T>(raw);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown cache error';
      this.logger.warn(`Cache GET error for key [${key}]: ${message}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.redisClient) {
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
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown cache error';
      this.logger.warn(`Cache SET error for key [${key}]: ${message}`);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    try {
      await this.redisClient.del(key);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown cache error';
      this.logger.warn(`Cache DELETE error for key [${key}]: ${message}`);
    }
  }

  async deleteMany(keys: readonly string[]): Promise<void> {
    if (!this.redisClient || keys.length === 0) {
      return;
    }

    try {
      await this.redisClient.del(...keys);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown cache error';
      this.logger.warn(
        `Cache DELETE_MANY error for keys [${keys.join(', ')}]: ${message}`,
      );
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
}
