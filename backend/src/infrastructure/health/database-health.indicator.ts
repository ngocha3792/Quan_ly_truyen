import { Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';

import { sanitizeErrorForLog } from '@/common/utils';
import { PrismaService } from '@/infrastructure/database';
import { MetricsService } from '@/infrastructure/observability';

@Injectable()
export class DatabaseHealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicator: HealthIndicatorService,
    private readonly metrics: MetricsService,
  ) {}

  async isHealthy(key = 'database'): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicator.check(key);

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      this.metrics.setDependencyHealth('database', 'up');
      return indicator.up();
    } catch (error: unknown) {
      this.logger.error(
        'Database health check failed',
        sanitizeErrorForLog(error),
      );
      this.metrics.setDependencyHealth('database', 'down');
      return indicator.down({
        message: 'Database unavailable',
      });
    }
  }
}
