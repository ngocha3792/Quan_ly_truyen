import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import type { DispatchOutboxBatchJobV1 } from '../contracts';
import { QUEUE_NAMES } from '../queue.constants';
import { getWorkerConcurrency } from '../worker-options';
import type { QueueTelemetryMetadata } from '@/common/interfaces/observability';
import { TracePropagationService } from '@/infrastructure/observability';

import { OutboxDispatcherService } from './outbox-dispatcher.service';

@Processor(QUEUE_NAMES.OUTBOX, { concurrency: getWorkerConcurrency() })
export class OutboxDispatcherProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxDispatcherProcessor.name);

  constructor(
    private readonly dispatcher: OutboxDispatcherService,
    private readonly propagation: TracePropagationService,
  ) {
    super();
  }

  async process(job: Job<DispatchOutboxBatchJobV1>): Promise<number> {
    const metadata: QueueTelemetryMetadata = {
      schemaVersion: 1,
      source: 'system',
      ...(job.data.correlationId
        ? { correlationId: job.data.correlationId }
        : {}),
      causationId: String(job.id ?? 'outbox-scheduler'),
    };
    return this.propagation.runWithQueueContext(
      metadata,
      {
        requestId: String(job.id ?? 'outbox-scheduler'),
        queue: QUEUE_NAMES.OUTBOX,
      },
      async () => {
        this.logger.debug({
          event: 'queue.job.started',
          'messaging.system': 'bullmq',
          'messaging.destination.name': QUEUE_NAMES.OUTBOX,
          'messaging.operation.name': 'process',
          'job.id': job.id,
          'job.name': job.name,
          'job.attempt': job.attemptsMade + 1,
        });
        const batchSize = job.data.batchSize ?? 50;
        const processedCount = await this.dispatcher.dispatchBatch(batchSize);
        this.logger.debug({
          event: 'queue.job.completed',
          'messaging.system': 'bullmq',
          'messaging.destination.name': QUEUE_NAMES.OUTBOX,
          'job.id': job.id,
          'job.name': job.name,
          processed: processedCount,
        });
        return processedCount;
      },
    );
  }
}
