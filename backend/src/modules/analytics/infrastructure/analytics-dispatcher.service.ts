import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { AnalyticsConfig } from '@/config';
import { PrismaService } from '@/infrastructure/database';
import { MetricsService } from '@/infrastructure/observability';
import { QUEUE_NAMES } from '@/infrastructure/queue';

@Injectable()
export class AnalyticsDispatcherService
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly analytics: AnalyticsConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
    @InjectQueue(QUEUE_NAMES.ANALYTICS) private readonly queue: Queue,
  ) {
    this.analytics = this.config.getOrThrow<AnalyticsConfig>('analytics');
  }

  onModuleInit(): void {
    if (!this.analytics.enabled) return;
    this.timer = setInterval(() => void this.dispatch(), 10_000);
    this.timer.unref?.();
    void this.dispatch();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async dispatch(): Promise<void> {
    if (this.running || !this.analytics.enabled) return;
    this.running = true;
    try {
      const stale = new Date(Date.now() - 5 * 60_000);
      const rows = await this.prisma.readerAnalyticsEvent.findMany({
        where: {
          processedAt: null,
          OR: [{ queuedAt: null }, { queuedAt: { lt: stale } }],
        },
        orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
        take: this.analytics.dispatcherBatchSize,
        select: { id: true },
      });
      if (rows.length === 0) return;
      const ids = rows.map((row) => row.id);
      for (
        let offset = 0;
        offset < ids.length;
        offset += this.analytics.processingBatchSize
      ) {
        const batchIds = ids.slice(
          offset,
          offset + this.analytics.processingBatchSize,
        );
        await this.queue.add(
          'reader-analytics-batch',
          { eventIds: batchIds },
          { jobId: `analytics-recovery-${randomUUID()}` },
        );
        await this.prisma.readerAnalyticsEvent.updateMany({
          where: { id: { in: batchIds }, processedAt: null },
          data: { queuedAt: new Date() },
        });
      }
      this.metrics.recordReaderAnalyticsProcessed('queue', 'success');
    } catch {
      this.metrics.recordReaderAnalyticsProcessed('queue', 'failed');
    } finally {
      this.running = false;
    }
  }
}
