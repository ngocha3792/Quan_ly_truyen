import { Processor, WorkerHost } from '@nestjs/bullmq';

import { Logger } from '@nestjs/common';

import { Job, UnrecoverableError } from 'bullmq';

import { TracePropagationService } from '@/infrastructure/observability';

import { QUEUE_NAMES } from '@/infrastructure/queue';

import {
  isEncryptedMailPayloadV1,
  SEND_MAIL_JOB,
  type MailQueuePayload,
  type OutboxQueueEnvelope,
  type SendMailJobV1,
} from '@/infrastructure/queue/contracts';

import { getWorkerConcurrency } from '@/infrastructure/queue/worker-options';

import { MailDispatchService } from '../application';

import type { MailDispatchResult } from '../contracts';

import { InvalidMailJobException, MailDeliveryException } from '../exceptions';

import { MailPayloadCipherService } from '../security';

import { mapMailJob } from './mail-job.mapper';

import { validateMailJob } from './mail-job.validator';

@Processor(QUEUE_NAMES.MAIL, {
  concurrency: getWorkerConcurrency(),
})
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(
    private readonly dispatchService: MailDispatchService,

    private readonly propagation: TracePropagationService,

    private readonly mailPayloadCipher: MailPayloadCipherService,
  ) {
    super();
  }

  async process(
    job: Job<OutboxQueueEnvelope<MailQueuePayload>>,
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
    job: Job<OutboxQueueEnvelope<MailQueuePayload>>,
  ): Promise<MailDispatchResult> {
    const startedAt = performance.now();

    try {
      if (job.name !== SEND_MAIL_JOB) {
        throw new UnrecoverableError(`Unsupported mail job: ${job.name}`);
      }

      /*
       * Chỉ tại đây ciphertext mới được giải mã.
       */
      const payload = this.resolvePayload(job.data.payload);

      const result = await this.dispatchService.dispatch(
        mapMailJob(payload, job.data.outboxEventId),
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

          template: payload.templateId,

          result: 'skipped',

          recipient_domain: recipientDomain(payload.recipientEmail),

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

          template: payload.templateId,

          result: 'success',

          recipient_domain: recipientDomain(payload.recipientEmail),

          duration_ms: Number((performance.now() - startedAt).toFixed(2)),
        });
      }

      return result;
    } catch (error: unknown) {
      if (error instanceof UnrecoverableError) {
        throw error;
      }

      /*
       * Chỉ SMTP error retryable mới được retry.
       *
       * Ciphertext sai, auth tag sai hoặc payload
       * không hợp lệ sẽ không tự sửa được khi retry.
       */
      if (error instanceof MailDeliveryException && error.retryable) {
        throw error;
      }

      throw new UnrecoverableError(
        error instanceof Error ? error.message : 'Invalid mail job',
      );
    }
  }

  private resolvePayload(value: MailQueuePayload): SendMailJobV1 {
    let plaintext: unknown;

    if (isEncryptedMailPayloadV1(value)) {
      plaintext = this.mailPayloadCipher.decrypt(value);
    } else {
      /*
       * Legacy compatibility cho các job đã nằm
       * trong queue trước khi deploy encryption.
       */
      if (!this.mailPayloadCipher.canReadLegacyPlaintext()) {
        throw new InvalidMailJobException(
          'Legacy plaintext mail payload is disabled',
        );
      }

      plaintext = value;
    }

    /*
     * Luôn validate sau khi giải mã.
     */
    validateMailJob(plaintext);

    return plaintext;
  }
}

function recipientDomain(email: string): string {
  return email.split('@').at(-1)?.toLowerCase() ?? 'unknown';
}
