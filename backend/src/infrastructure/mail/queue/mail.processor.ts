import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';

import {
  SEND_MAIL_JOB,
  type OutboxQueueEnvelope,
  type SendMailJobV1,
} from '@/infrastructure/queue/contracts';
import { QUEUE_NAMES } from '@/infrastructure/queue';
import { getWorkerConcurrency } from '@/infrastructure/queue/worker-options';
import { TracePropagationService } from '@/infrastructure/observability';

import { MailDispatchService } from '../application';
import type { MailDispatchResult } from '../contracts';
import { MailDeliveryException } from '../exceptions';
import { mapMailJob } from './mail-job.mapper';
import { validateMailJob } from './mail-job.validator';

@Processor(QUEUE_NAMES.MAIL, { concurrency: getWorkerConcurrency() })
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);
  constructor(
    private readonly dispatchService: MailDispatchService,
    private readonly propagation: TracePropagationService,
  ) {
    super();
  }

  async process(
    job: Job<OutboxQueueEnvelope<SendMailJobV1>>,
  ): Promise<MailDispatchResult> {
    return this.propagation.runWithQueueContext(
      job.data.telemetry,
      {
        requestId:
          job.data.telemetry?.causationId ?? String(job.id ?? 'mail-job'),
        queue: QUEUE_NAMES.MAIL,
      },
      () => this.processInternal(job),
    );
  }

  private async processInternal(
    job: Job<OutboxQueueEnvelope<SendMailJobV1>>,
  ): Promise<MailDispatchResult> {
    const startedAt = performance.now();
    try {
      if (job.name !== SEND_MAIL_JOB)
        throw new UnrecoverableError(`Unsupported mail job: ${job.name}`);
      validateMailJob(job.data.payload);
      const result = await this.dispatchService.dispatch(
        mapMailJob(job.data.payload, job.data.outboxEventId),
      );
      if (result.status === 'skipped') {
        this.logger.log({
          event: 'mail.delivery.completed',
          'messaging.system': 'bullmq',
          'messaging.destination.name': QUEUE_NAMES.MAIL,
          'job.id': job.id,
          'job.name': job.name,
          'job.attempt': job.attemptsMade + 1,
          outboxEventId: job.data.outboxEventId,
          template: job.data.payload.templateId,
          result: 'skipped',
          recipient_domain: recipientDomain(job.data.payload.recipientEmail),
          duration_ms: Number((performance.now() - startedAt).toFixed(2)),
        });
      } else {
        this.logger.log({
          event: 'mail.delivery.completed',
          'messaging.system': 'bullmq',
          'messaging.destination.name': QUEUE_NAMES.MAIL,
          'job.id': job.id,
          'job.name': job.name,
          'job.attempt': job.attemptsMade + 1,
          outboxEventId: job.data.outboxEventId,
          messageId: result.messageId,
          template: job.data.payload.templateId,
          result: 'success',
          recipient_domain: recipientDomain(job.data.payload.recipientEmail),
          duration_ms: Number((performance.now() - startedAt).toFixed(2)),
        });
      }
      return result;
    } catch (error: unknown) {
      if (error instanceof UnrecoverableError) throw error;
      if (error instanceof MailDeliveryException && error.retryable)
        throw error;
      throw new UnrecoverableError(
        error instanceof Error ? error.message : 'Invalid mail job',
      );
    }
  }
}

function recipientDomain(email: string): string {
  return email.split('@').at(-1)?.toLowerCase() ?? 'unknown';
}
