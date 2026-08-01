import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

import type { ObservabilityConfig } from '@/config';
import { MetricsService } from '@/infrastructure/observability';

import { QUEUE_NAMES, type QueueName } from '../queue.constants';

@Injectable()
export class QueueMetricsObserver
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(QueueMetricsObserver.name);
  private timer?: NodeJS.Timeout;
  private activeCollection?: Promise<void>;
  private stopped = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly metrics: MetricsService,
    @InjectQueue(QUEUE_NAMES.MEDIA) private readonly mediaQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MAIL) private readonly mailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.STORY_SCHEDULING)
    private readonly storySchedulingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ANALYTICS) private readonly analyticsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.OUTBOX) private readonly outboxQueue: Queue,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.metrics.isEnabled()) return;
    this.schedule(0);
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.activeCollection;
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

  private async collect(): Promise<void> {
    try {
      await Promise.all(
        this.queues().map(([name, queue]) => this.collectQueue(name, queue)),
      );
    } catch (error: unknown) {
      this.logger.warn({
        event: 'queue.metrics.snapshot.failed',
        'error.type': error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  private async collectQueue(name: QueueName, queue: Queue): Promise<void> {
    const [counts, workers, waiting] = await Promise.all([
      queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
      queue.getWorkersCount(),
      queue.getWaiting(0, 0),
    ]);
    this.metrics.setQueueSnapshot({
      queue: name,
      counts: {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
      },
      workers,
      oldestWaitingAgeSeconds: oldestWaitingAgeSeconds(waiting),
    });
  }

  private queues(): ReadonlyArray<readonly [QueueName, Queue]> {
    return [
      [QUEUE_NAMES.MEDIA, this.mediaQueue],
      [QUEUE_NAMES.MAIL, this.mailQueue],
      [QUEUE_NAMES.NOTIFICATIONS, this.notificationQueue],
      [QUEUE_NAMES.STORY_SCHEDULING, this.storySchedulingQueue],
      [QUEUE_NAMES.ANALYTICS, this.analyticsQueue],
      [QUEUE_NAMES.OUTBOX, this.outboxQueue],
    ];
  }

  private intervalMs(): number {
    return this.configService.getOrThrow<ObservabilityConfig>('observability')
      .metrics.snapshotIntervalMs;
  }
}

function oldestWaitingAgeSeconds(
  jobs: ReadonlyArray<{ timestamp?: number }>,
): number {
  const oldestTimestamp = jobs[0]?.timestamp;
  return typeof oldestTimestamp === 'number'
    ? Math.max(0, Date.now() - oldestTimestamp) / 1000
    : 0;
}
