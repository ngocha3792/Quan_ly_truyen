import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import type Redis from 'ioredis';

import { sanitizeErrorForLog } from '@/common/utils';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';
import { MetricsService } from '@/infrastructure/observability';

@Injectable()
export class RedisHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | null,
    private readonly healthIndicator: HealthIndicatorService,
    private readonly metrics: MetricsService,
  ) {}

  async isHealthy(key = 'redis'): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicator.check(key);

    if (!this.redisClient) {
      this.metrics.setDependencyHealth('redis', 'disabled');
      return indicator.up({ disabled: true });
    }

    try {
      const pingResult = await this.redisClient.ping();
      if (pingResult === 'PONG') {
        this.metrics.setDependencyHealth('redis', 'up');
        return indicator.up();
      }
      this.metrics.setDependencyHealth('redis', 'down');
      return indicator.down({
        message: 'Redis health check failed',
      });
    } catch (error: unknown) {
      this.logger.error(
        'Redis health check failed',
        sanitizeErrorForLog(error),
      );
      this.metrics.recordRedisError('health');
      this.metrics.setDependencyHealth('redis', 'down');
      return indicator.down({
        message: 'Redis unavailable',
      });
    }
  }
}
