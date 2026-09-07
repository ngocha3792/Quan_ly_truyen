import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import type { AnalyticsConfig } from '@/config';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';
import {
  addUtcDays,
  analyticsDate,
  dateKeyFromUtcDate,
} from '../../domain/value-objects/analytics-time';
import { PrismaAnalyticsReconciliationAdapter } from '../persistence/prisma-analytics-reconciliation.adapter';
import {
  ANALYTICS_RECONCILIATION_HEARTBEAT_KEY,
  ANALYTICS_RECONCILIATION_HEARTBEAT_TTL_SECONDS,
} from '../observability/analytics-health.constants';

@Injectable()
export class AnalyticsMaintenanceScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AnalyticsMaintenanceScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastSettledDate?: string;
  private readonly analytics: AnalyticsConfig;

  constructor(
    config: ConfigService,
    private readonly reconciliation: PrismaAnalyticsReconciliationAdapter,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | null,
  ) {
    this.analytics = config.getOrThrow<AnalyticsConfig>('analytics');
  }

  onModuleInit(): void {
    if (!this.analytics.enabled) return;
    this.timer = setInterval(() => this.runTick(), 5 * 60_000);
    this.timer.unref?.();
    this.runTick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<void> {
    if (this.running || !this.analytics.enabled) return;
    this.running = true;
    try {
      const today = analyticsDate(now, this.analytics.timeZone);
      const yesterday = addUtcDays(today, -1);
      await this.reconciliation.recomputeUniqueReaders(
        dateKeyFromUtcDate(today),
      );
      await this.reconciliation.recomputeUniqueReaders(
        dateKeyFromUtcDate(yesterday),
      );

      // Events may be backdated up to 24h. Finalize D-2 only when the lateness
      // window has closed and there is no unprocessed backlog for that day.
      const settled = dateKeyFromUtcDate(addUtcDays(today, -2));
      if (this.lastSettledDate !== settled) {
        const finalized =
          await this.reconciliation.reconcileSettledDate(settled);
        if (finalized) this.lastSettledDate = settled;
      }

      // One bounded retention batch per maintenance tick. Large tables are
      // drained gradually instead of a single long-running DELETE transaction.
      await this.reconciliation.cleanupProcessedBatch();
      await this.writeReconciliationHeartbeat();
    } finally {
      this.running = false;
    }
  }

  private runTick(): void {
    void this.tick().catch((error: unknown) => {
      this.logger.error({
        event: 'reader-analytics.maintenance.failed',
        'error.type': error instanceof Error ? error.name : 'UnknownError',
      });
    });
  }

  private async writeReconciliationHeartbeat(): Promise<void> {
    if (!this.redisClient) {
      throw new Error('Analytics reconciliation heartbeat requires Redis');
    }
    await this.redisClient.set(
      ANALYTICS_RECONCILIATION_HEARTBEAT_KEY,
      String(Date.now()),
      'EX',
      ANALYTICS_RECONCILIATION_HEARTBEAT_TTL_SECONDS,
    );
  }
}
