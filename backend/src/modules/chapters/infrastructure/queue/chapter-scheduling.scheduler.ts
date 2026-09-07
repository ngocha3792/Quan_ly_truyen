import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { sanitizeErrorForLog } from '@/common/utils';
import type { QueueConfig } from '@/config';
import {
  PUBLISH_SCHEDULED_CHAPTERS_JOB,
  type PublishScheduledChaptersJobV1,
} from '@/infrastructure/queue/contracts';
import { QUEUE_NAMES } from '@/infrastructure/queue/queue.constants';

export const CHAPTER_SCHEDULING_SCHEDULER_ID =
  'chapter-scheduling-publish-due-v1';

@Injectable()
export class ChapterSchedulingScheduler implements OnModuleInit {
  private readonly logger = new Logger(ChapterSchedulingScheduler.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.STORY_SCHEDULING)
    private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    const queueConfig = this.configService.get<QueueConfig>('queue');
    if (!queueConfig?.enabled) return;

    try {
      const data: PublishScheduledChaptersJobV1 = {
        version: 1,
        batchSize: queueConfig.chapterSchedulingBatchSize,
      };
      await this.queue.upsertJobScheduler(
        CHAPTER_SCHEDULING_SCHEDULER_ID,
        { every: queueConfig.chapterSchedulingPollIntervalMs },
        {
          name: PUBLISH_SCHEDULED_CHAPTERS_JOB,
          data,
          opts: {
            removeOnComplete: { count: 20 },
            removeOnFail: { count: 100 },
          },
        },
      );
      this.logger.log(
        `Chapter scheduling registered (every ${queueConfig.chapterSchedulingPollIntervalMs}ms)`,
      );
    } catch (error: unknown) {
      this.logger.error(
        'Failed to register chapter scheduling worker',
        sanitizeErrorForLog(error),
      );
      throw error;
    }
  }
}
