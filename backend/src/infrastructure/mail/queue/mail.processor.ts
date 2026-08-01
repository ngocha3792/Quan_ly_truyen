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

import { MailDispatchService } from '../application';
import type { MailDispatchResult } from '../contracts';
import { MailDeliveryException } from '../exceptions';
import { mapMailJob } from './mail-job.mapper';
import { validateMailJob } from './mail-job.validator';

@Processor(QUEUE_NAMES.MAIL, { concurrency: getWorkerConcurrency() })
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);
  constructor(private readonly dispatchService: MailDispatchService) {
    super();
  }

  async process(
    job: Job<OutboxQueueEnvelope<SendMailJobV1>>,
  ): Promise<MailDispatchResult> {
    try {
      if (job.name !== SEND_MAIL_JOB)
        throw new UnrecoverableError(`Unsupported mail job: ${job.name}`);
      validateMailJob(job.data.payload);
      const result = await this.dispatchService.dispatch(
        mapMailJob(job.data.payload, job.data.outboxEventId),
      );
      if (result.status === 'skipped') {
        this.logger.log(`Mail job ${job.id} skipped because mail is disabled`);
      } else {
        this.logger.log(
          `Mail job ${job.id} accepted by SMTP (messageId=${result.messageId})`,
        );
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
