import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { MailConfig } from '@/config';
import { AccountStatus, type Prisma } from '@/generated/prisma/client';
import { MailTemplateId } from '@/infrastructure/mail/templates';
import { SEND_MAIL_JOB } from '@/infrastructure/queue/contracts';
import { OutboxWriterService } from '@/infrastructure/queue/outbox';

export interface TransactionalReceiptInput {
  readonly userId: string;
  readonly dedupeKey: string;
  readonly type:
    | 'credit_top_up'
    | 'chapter_purchase'
    | 'chapter_refund'
    | 'payment_refund'
    | 'payment_rejected';
  readonly title: string;
  readonly body: string;
  readonly tag: string;
  readonly transactionId: string;
  readonly amountCredits: bigint;
  readonly data?: Readonly<Record<string, string | number | boolean | null>>;
}

@Injectable()
export class TransactionalReceiptService {
  private readonly mail: MailConfig;

  constructor(
    config: ConfigService,
    private readonly outboxWriter: OutboxWriterService,
  ) {
    this.mail = config.getOrThrow<MailConfig>('mail');
  }

  async enqueue(
    tx: Prisma.TransactionClient,
    input: TransactionalReceiptInput,
  ): Promise<void> {
    const recipient = await tx.user.findFirst({
      where: {
        id: input.userId,
        status: AccountStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        email: true,
        displayName: true,
        emailVerifiedAt: true,
        notificationPreference: {
          select: { inAppEnabled: true, emailEnabled: true },
        },
      },
    });
    if (!recipient) return;

    if (recipient.notificationPreference?.inAppEnabled !== false) {
      await tx.notification.upsert({
        where: { dedupeKey: input.dedupeKey },
        create: {
          dedupeKey: input.dedupeKey,
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          data: {
            category: 'account',
            tag: input.tag,
            route: ['/tai-khoan', 'credit'],
            transactionId: input.transactionId,
            amountCredits: input.amountCredits.toString(),
            ...(input.data ?? {}),
          },
        },
        update: {},
      });
    }

    if (
      !this.mail.enabled ||
      recipient.emailVerifiedAt === null ||
      recipient.notificationPreference?.emailEnabled === false
    ) {
      return;
    }

    const outboxKey = `${input.dedupeKey}:email`;
    const existing = await tx.outboxEvent.findUnique({
      where: { idempotencyKey: outboxKey },
      select: { id: true },
    });
    if (existing) return;

    await this.outboxWriter.create(tx, {
      aggregateType: 'mail',
      aggregateId: input.userId,
      eventType: SEND_MAIL_JOB,
      idempotencyKey: outboxKey,
      causationId: input.transactionId,
      payload: {
        version: 1,
        templateId: MailTemplateId.CREDIT_ACTIVITY,
        recipientEmail: recipient.email,
        variables: {
          displayName: recipient.displayName,
          title: input.title,
          body: input.body,
          amountCredits: input.amountCredits.toString(),
          transactionId: input.transactionId,
          actionUrl: new URL(
            '/tai-khoan/credit',
            this.mail.frontendPublicUrl,
          ).toString(),
        },
        correlationId: input.transactionId,
      },
    });
  }
}
