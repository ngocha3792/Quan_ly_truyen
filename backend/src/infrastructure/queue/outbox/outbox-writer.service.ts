import { Injectable } from '@nestjs/common';

import { OutboxStatus, type Prisma } from '@/generated/prisma/client';

import { MailPayloadCipherService } from '@/infrastructure/mail/security';

import { TracePropagationService } from '@/infrastructure/observability';

import { SEND_MAIL_JOB } from '@/infrastructure/queue/contracts';

import type { CreateOutboxEventInput } from './outbox.types';

@Injectable()
export class OutboxWriterService {
  constructor(
    private readonly propagation: TracePropagationService,

    private readonly mailPayloadCipher: MailPayloadCipherService,
  ) {}

  create(
    tx: Prisma.TransactionClient,

    input: CreateOutboxEventInput,
  ): Promise<{ id: string }> {
    const metadata =
      input.metadata ??
      this.propagation.capture({
        source: 'api',

        causationId: input.causationId,
      });

    /*
     * Tất cả producer có eventType mail.send.v1
     * đều bị bắt buộc mã hóa.
     *
     * Auth repository không thể vô tình lưu
     * plaintext mail payload nữa.
     */
    const persistedPayload =
      input.eventType === SEND_MAIL_JOB
        ? this.mailPayloadCipher.encrypt(input.payload)
        : input.payload;

    return tx.outboxEvent.create({
      data: {
        aggregateType: input.aggregateType,

        aggregateId: input.aggregateId,

        eventType: input.eventType,

        idempotencyKey: input.idempotencyKey,

        payload: persistedPayload as Prisma.InputJsonValue,

        metadata: metadata as unknown as Prisma.InputJsonObject,

        status: OutboxStatus.PENDING,

        availableAt: input.availableAt ?? new Date(),
      },

      select: {
        id: true,
      },
    });
  }
}
