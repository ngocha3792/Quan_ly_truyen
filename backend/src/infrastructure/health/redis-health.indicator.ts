import { Inject, Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | null,
    private readonly healthIndicator: HealthIndicatorService,
  ) {}

  async isHealthy(key = 'redis'): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicator.check(key);

    if (!this.redisClient) {
      return indicator.up({ disabled: true });
    }

    try {
      const pingResult = await this.redisClient.ping();
      if (pingResult === 'PONG') {
        return indicator.up();
      }
      return indicator.down({
        message: `Unexpected PING response: ${String(pingResult)}`,
      });
    } catch (error: unknown) {
      return indicator.down({
        message: error instanceof Error ? error.message : 'Redis unavailable',
      });
    }
  }
}
