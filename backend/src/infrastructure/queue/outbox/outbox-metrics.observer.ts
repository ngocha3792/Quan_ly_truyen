import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ObservabilityConfig } from '@/config';
import { OutboxStatus } from '@/generated/prisma/enums';
import { PrismaService } from '@/infrastructure/database';
import { MetricsService } from '@/infrastructure/observability';

@Injectable()
export class OutboxMetricsObserver
  implements OnApplicationBootstrap, OnModuleDestroy
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
    if (!this.metrics.isEnabled()) {
      return;
    }

    this.schedule(0);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    await this.activeCollection;
  }

  async collect(): Promise<void> {
    if (this.stopped) {
      return;
    }

    try {
      /*
       * Metrics không cần transaction snapshot tuyệt đối.
       *
       * Promise.all tránh lỗi transaction bị đóng khi ứng dụng
       * đang teardown Prisma.
       */
      const [pending, processing, failed, oldest] = await Promise.all([
        this.prisma.outboxEvent.count({
          where: {
            status: OutboxStatus.PENDING,
          },
        }),

        this.prisma.outboxEvent.count({
          where: {
            status: OutboxStatus.PROCESSING,
          },
        }),

        this.prisma.outboxEvent.count({
          where: {
            status: OutboxStatus.FAILED,
          },
        }),

        this.prisma.outboxEvent.findFirst({
          where: {
            status: OutboxStatus.PENDING,
          },
          orderBy: {
            availableAt: 'asc',
          },
          select: {
            availableAt: true,
          },
        }),
      ]);

      if (this.stopped) {
        return;
      }

      this.metrics.setOutboxBacklog(
        {
          pending,
          processing,
          failed,
        },
        oldest
          ? Math.max(0, Date.now() - oldest.availableAt.getTime()) / 1000
          : 0,
      );
    } catch (error: unknown) {
      /*
       * Trong lúc teardown, Prisma có thể đã bắt đầu đóng.
       * Không log cảnh báo giả sau khi observer đã dừng.
       */
      if (this.stopped) {
        return;
      }

      this.logger.warn({
        event: 'outbox.metrics.snapshot.failed',
        'error.type': error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  private schedule(delayMs: number): void {
    if (this.stopped) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = undefined;

      if (this.stopped) {
        return;
      }

      const collection = this.collect();

      this.activeCollection = collection;

      void collection.finally(() => {
        if (this.activeCollection === collection) {
          this.activeCollection = undefined;
        }

        if (!this.stopped) {
          this.schedule(this.intervalMs());
        }
      });
    }, delayMs);

    this.timer.unref();
  }

  private intervalMs(): number {
    return this.configService.getOrThrow<ObservabilityConfig>('observability')
      .metrics.snapshotIntervalMs;
  }
}
