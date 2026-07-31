import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import type { QueueConfig } from '@/config';

import type { DispatchOutboxBatchJobV1 } from '../contracts';
import { DISPATCH_OUTBOX_BATCH_JOB } from '../contracts';
import { QUEUE_NAMES } from '../queue.constants';

const OUTBOX_POLL_INTERVAL_MS = 10_000;

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

    await this.registerRepeatableJob();
  }

  private async registerRepeatableJob(): Promise<void> {
    try {
      // Remove existing repeatable jobs to prevent duplicates on restart
      const existingJobs = await this.outboxQueue.getRepeatableJobs();

      for (const job of existingJobs) {
        if (job.name === DISPATCH_OUTBOX_BATCH_JOB) {
          await this.outboxQueue.removeRepeatableByKey(job.key);
        }
      }

      const jobData: DispatchOutboxBatchJobV1 = {
        version: 1,
        batchSize: 50,
      };

      await this.outboxQueue.add(DISPATCH_OUTBOX_BATCH_JOB, jobData, {
        repeat: {
          every: OUTBOX_POLL_INTERVAL_MS,
        },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 50 },
      });

      this.logger.log(
        `Outbox repeatable job registered (every ${OUTBOX_POLL_INTERVAL_MS}ms)`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to register outbox repeatable job: ${message}`);
    }
  }
}
