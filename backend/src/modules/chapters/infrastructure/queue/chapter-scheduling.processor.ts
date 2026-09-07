import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import type { QueueTelemetryMetadata } from '@/common/interfaces/observability';
import {
  PUBLISH_SCHEDULED_CHAPTERS_JOB,
  type PublishScheduledChaptersJobV1,
} from '@/infrastructure/queue/contracts';
import { QUEUE_NAMES } from '@/infrastructure/queue/queue.constants';
import { getWorkerConcurrency } from '@/infrastructure/queue/worker-options';
import { TracePropagationService } from '@/infrastructure/observability';

import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../application';

@Processor(QUEUE_NAMES.STORY_SCHEDULING, {
  concurrency: getWorkerConcurrency(),
})
export class ChapterSchedulingProcessor extends WorkerHost {
  private readonly logger = new Logger(ChapterSchedulingProcessor.name);

  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
    private readonly propagation: TracePropagationService,
  ) {
    super();
  }

  async process(job: Job<PublishScheduledChaptersJobV1>): Promise<number> {
    if (job.name !== PUBLISH_SCHEDULED_CHAPTERS_JOB) {
      this.logger.warn(
        `Ignoring unsupported story scheduling job: ${job.name}`,
      );
      return 0;
    }

    const requestId = String(job.id ?? 'chapter-scheduling');
    const metadata: QueueTelemetryMetadata = {
      schemaVersion: 1,
      source: 'system',
      causationId: requestId,
    };

    return this.propagation.runWithQueueContext(
      metadata,
      {
        requestId,
        queue: QUEUE_NAMES.STORY_SCHEDULING,
      },
      async () => {
        const batchSize = Number.isInteger(job.data.batchSize)
          ? job.data.batchSize
          : 25;
        const published = await this.persistence.publishDueScheduled({
          dueAt: new Date(),
          batchSize,
          requestId,
        });
        if (published > 0) {
          this.logger.log(`Published ${published} scheduled chapter(s)`);
        }
        return published;
      },
    );
  }
}
