import { createHash } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type Redis from 'ioredis';

import {
  RateLimitExceededException,
  ServiceUnavailableException,
} from '@/common/exceptions';
import { monetizationConfig } from '@/config';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';

import {
  MONETIZATION_RATE_LIMITS_PER_MINUTE,
  type MonetizationRateLimiterPort,
} from '../../application';

@Injectable()
export class RedisMonetizationRateLimiter implements MonetizationRateLimiterPort {
  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    @Inject(monetizationConfig.KEY)
    private readonly config: ConfigType<typeof monetizationConfig>,
  ) {}

  async consume(
    input: Parameters<MonetizationRateLimiterPort['consume']>[0],
  ): Promise<void> {
    if (!this.config.enabled) return;
    if (!this.redis) {
      throw new ServiceUnavailableException({
        code: 'MONETIZATION_PROTECTION_UNAVAILABLE',
        message: 'Hệ thống bảo vệ giao dịch tạm thời không khả dụng',
        service: 'monetization-rate-limit',
      });
    }

    const windowSeconds = 60;
    const limit = MONETIZATION_RATE_LIMITS_PER_MINUTE[input.operation];
    const subjectHash = createHash('sha256')
      .update(input.subject.trim().toLowerCase())
      .digest('hex')
      .slice(0, 32);
    const key = `monetization:rate-limit:v1:${input.operation}:${subjectHash}`;
    let result: [number, number];
    try {
      result = (await this.redis.eval(
        `local c=redis.call('INCR',KEYS[1]); if c==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return {c,redis.call('TTL',KEYS[1])}`,
        1,
        key,
        String(windowSeconds),
      )) as [number, number];
    } catch {
      throw this.protectionUnavailable();
    }
    const [count, ttl] = result;

    if (Number(count) > limit) {
      throw new RateLimitExceededException({
        code: 'MONETIZATION_RATE_LIMITED',
        message: 'Thao tác tiền tệ bị giới hạn tần suất',
        retryAfterSeconds: Math.max(1, Number(ttl) || windowSeconds),
        limit,
        details: { operation: input.operation },
      });
    }
  }

  private protectionUnavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'MONETIZATION_PROTECTION_UNAVAILABLE',
      message: 'Hệ thống bảo vệ giao dịch tạm thời không khả dụng',
      service: 'monetization-rate-limit',
    });
  }
}
