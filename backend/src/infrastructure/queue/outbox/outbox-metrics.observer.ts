import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ObservabilityConfig } from '@/config';
import { OutboxStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/infrastructure/database';
import { MetricsService } from '@/infrastructure/observability';

@Injectable()
export class OutboxMetricsObserver
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxMetricsObserver.name);
  private timer?: NodeJS.Timeout;
  private activeCollection?: Promise<void>;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.metrics.isEnabled()) this.schedule(0);
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.activeCollection;
  }

  async collect(): Promise<void> {
    try {
      const [pending, processing, failed, oldest] =
        await this.prisma.$transaction([
          this.prisma.outboxEvent.count({
            where: { status: OutboxStatus.PENDING },
          }),
          this.prisma.outboxEvent.count({
            where: { status: OutboxStatus.PROCESSING },
          }),
          this.prisma.outboxEvent.count({
            where: { status: OutboxStatus.FAILED },
          }),
          this.prisma.outboxEvent.findFirst({
            where: { status: OutboxStatus.PENDING },
            orderBy: { availableAt: 'asc' },
            select: { availableAt: true },
          }),
        ]);
      this.metrics.setOutboxBacklog(
        { pending, processing, failed },
        oldest
          ? Math.max(0, Date.now() - oldest.availableAt.getTime()) / 1000
          : 0,
      );
    } catch (error: unknown) {
      this.logger.warn({
        event: 'outbox.metrics.snapshot.failed',
        'error.type': error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const collection = this.collect();
      this.activeCollection = collection;
      void collection.finally(() => {
        if (this.activeCollection === collection)
          this.activeCollection = undefined;
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
