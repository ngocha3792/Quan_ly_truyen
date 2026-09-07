import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import type { AnalyticsConfig, ObservabilityConfig } from '@/config';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';
import { PrismaService } from '@/infrastructure/database';
import { MetricsService } from '@/infrastructure/observability';

import {
  ANALYTICS_RECONCILIATION_HEARTBEAT_KEY,
  ANALYTICS_RECONCILIATION_HEARTBEAT_TTL_SECONDS,
} from './analytics-health.constants';

@Injectable()
export class AnalyticsMetricsObserver
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(AnalyticsMetricsObserver.name);
  private timer?: NodeJS.Timeout;
  private activeCollection?: Promise<void>;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly metrics: MetricsService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | null,
  ) {}

  onApplicationBootstrap(): void {
    if (this.metrics.isEnabled()) this.schedule(0);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    await this.activeCollection;
  }

  async collect(now = new Date()): Promise<void> {
    if (this.stopped) return;
    const analytics =
      this.configService.getOrThrow<AnalyticsConfig>('analytics');
    if (!analytics.enabled) {
      this.metrics.setReaderAnalyticsHealth({
        enabled: false,
        backlogEvents: 0,
        oldestUnprocessedAgeSeconds: 0,
        reconciliationHealthy: true,
        reconciliationAgeSeconds: 0,
      });
      return;
    }

    this.metrics.setReaderAnalyticsEnabled(true);
    try {
      const [backlogEvents, oldest, heartbeat] = await Promise.all([
        this.prisma.readerAnalyticsEvent.count({
          where: { processedAt: null },
        }),
        this.prisma.readerAnalyticsEvent.findFirst({
          where: { processedAt: null },
          orderBy: { receivedAt: 'asc' },
          select: { receivedAt: true },
        }),
        this.redisClient?.get(ANALYTICS_RECONCILIATION_HEARTBEAT_KEY) ??
          Promise.resolve(null),
      ]);
      if (this.stopped) return;

      const reconciliationTimestamp = heartbeat ? Number(heartbeat) : NaN;
      const reconciliationAgeSeconds =
        Number.isFinite(reconciliationTimestamp) && reconciliationTimestamp > 0
          ? Math.max(0, now.getTime() - reconciliationTimestamp) / 1000
          : 0;
      const reconciliationHealthy =
        Number.isFinite(reconciliationTimestamp) &&
        reconciliationTimestamp > 0 &&
        reconciliationAgeSeconds <=
          ANALYTICS_RECONCILIATION_HEARTBEAT_TTL_SECONDS;

      this.metrics.setReaderAnalyticsHealth({
        enabled: true,
        backlogEvents,
        oldestUnprocessedAgeSeconds: oldest
          ? Math.max(0, now.getTime() - oldest.receivedAt.getTime()) / 1000
          : 0,
        reconciliationHealthy,
        reconciliationAgeSeconds,
      });
    } catch (error: unknown) {
      if (this.stopped) return;
      this.metrics.setReaderAnalyticsSnapshotHealthy(false);
      this.logger.warn({
        event: 'reader-analytics.metrics.snapshot.failed',
        'error.type': error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.stopped) return;
      const collection = this.collect();
      this.activeCollection = collection;
      void collection.finally(() => {
        if (this.activeCollection === collection) {
          this.activeCollection = undefined;
        }
        if (!this.stopped) this.schedule(this.intervalMs());
      });
    }, delayMs);
    this.timer.unref();
  }

  private intervalMs(): number {
    return this.configService.getOrThrow<ObservabilityConfig>('observability')
      .metrics.snapshotIntervalMs;
  }
}
