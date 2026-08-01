import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import type { DispatchOutboxBatchJobV1 } from '../contracts';
import { QUEUE_NAMES } from '../queue.constants';
import { getWorkerConcurrency } from '../worker-options';

import { OutboxDispatcherService } from './outbox-dispatcher.service';

@Processor(QUEUE_NAMES.OUTBOX, { concurrency: getWorkerConcurrency() })
export class OutboxDispatcherProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxDispatcherProcessor.name);

  constructor(private readonly dispatcher: OutboxDispatcherService) {
    super();
  }

  async process(job: Job<DispatchOutboxBatchJobV1>): Promise<number> {
    this.logger.debug(`Processing outbox dispatch job ${job.id}`);

    const batchSize = job.data.batchSize ?? 50;
    const processedCount = await this.dispatcher.dispatchBatch(batchSize);

    this.logger.debug(
      `Outbox dispatch job ${job.id} completed: ${processedCount} events processed`,
    );

    return processedCount;
  }
}
