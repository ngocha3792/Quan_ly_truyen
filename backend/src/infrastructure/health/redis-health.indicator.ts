import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';

@Injectable()
export class RedisHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

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
        message: 'Redis health check failed',
      });
    } catch (error: unknown) {
      this.logger.error(
        'Redis health check failed',
        error instanceof Error ? error.stack : String(error),
      );
      return indicator.down({
        message: 'Redis unavailable',
      });
    }
  }
}
