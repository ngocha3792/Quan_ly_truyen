import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ObservabilityConfig } from '@/config';
import { InboundWebhookStatus } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma';
import { MetricsService } from '@/infrastructure/observability';

@Injectable()
export class CloudinaryWebhookMetricsObserver
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(CloudinaryWebhookMetricsObserver.name);
  private timer?: NodeJS.Timeout;
  private active?: Promise<void>;
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
    await this.active;
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      const snapshot = this.collect();
      this.active = snapshot;
      void snapshot.finally(() => {
        if (this.active === snapshot) this.active = undefined;
        this.schedule(this.intervalMs());
      });
    }, delayMs);
    this.timer.unref();
  }

  private async collect(): Promise<void> {
    try {
      const [pending, failed, processing, oldest] = await Promise.all([
        this.count(InboundWebhookStatus.PENDING),
        this.count(InboundWebhookStatus.FAILED),
        this.count(InboundWebhookStatus.PROCESSING),
        this.prisma.inboundWebhookEvent.findFirst({
          where: {
            provider: 'cloudinary',
            status: InboundWebhookStatus.PENDING,
          },
          orderBy: { receivedAt: 'asc' },
          select: { receivedAt: true },
        }),
      ]);
      this.metrics.setWebhookBacklog(
        { pending, failed, processing },
        oldest
          ? Math.max(0, Date.now() - oldest.receivedAt.getTime()) / 1000
          : 0,
      );
    } catch (error: unknown) {
      this.logger.warn({
        event: 'cloudinary.webhook.metrics.snapshot.failed',
        'error.type': error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  private count(status: InboundWebhookStatus): Promise<number> {
    return this.prisma.inboundWebhookEvent.count({
      where: { provider: 'cloudinary', status },
    });
  }

  private intervalMs(): number {
    return this.configService.getOrThrow<ObservabilityConfig>('observability')
      .metrics.snapshotIntervalMs;
  }
}
