import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { sanitizeErrorForLog } from '@/common/utils';
import type { QueueConfig } from '@/config';

import type { DispatchOutboxBatchJobV1 } from '../contracts';
import { DISPATCH_OUTBOX_BATCH_JOB } from '../contracts';
import { QUEUE_NAMES } from '../queue.constants';

export const OUTBOX_SCHEDULER_ID = 'outbox-dispatch-scheduler-v1';

@Injectable()
export class OutboxSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(OutboxSchedulerService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.OUTBOX)
    private readonly outboxQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    const queueConfig = this.configService.get<QueueConfig>('queue');

    if (!queueConfig?.enabled) {
      this.logger.log('Outbox scheduler disabled (QUEUE_ENABLED=false)');
      return;
    }

    try {
      await this.registerScheduler();
    } catch (error: unknown) {
      this.logger.error(
        'Failed to register required outbox scheduler',
        sanitizeErrorForLog(error),
      );
      throw error;
    }
  }

  private async registerScheduler(): Promise<void> {
    const queueConfig = this.configService.getOrThrow<QueueConfig>('queue');
    const jobData: DispatchOutboxBatchJobV1 = {
      version: 1,
      batchSize: queueConfig.outboxBatchSize,
    };

    await this.outboxQueue.upsertJobScheduler(
      OUTBOX_SCHEDULER_ID,
      { every: queueConfig.outboxPollIntervalMs },
      {
        name: DISPATCH_OUTBOX_BATCH_JOB,
        data: jobData,
        opts: {
          removeOnComplete: { count: 10 },
          removeOnFail: { count: 50 },
        },
      },
    );

    this.logger.log(
      `Outbox scheduler registered (every ${queueConfig.outboxPollIntervalMs}ms)`,
    );
  }
}
