import { Injectable } from '@nestjs/common';

import { Prisma, TokenType } from '@/generated/prisma/client';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';
import { MailTemplateId } from '@/infrastructure/mail/templates';
import {
  SEND_MAIL_JOB,
  type SendMailJobV1,
} from '@/infrastructure/queue/contracts';
import { OutboxWriterService } from '@/infrastructure/queue/outbox/outbox-writer.service';

import type {
  ResendEmailVerificationInput,
  ResendEmailVerificationPersistencePort,
  ResendEmailVerificationStatus,
} from '../../../../application/ports';
import { EmailVerificationUrlBuilder } from '../../../mail';

@Injectable()
export class PrismaResendEmailVerificationPersistence implements ResendEmailVerificationPersistencePort {
  constructor(
    private readonly prisma: PrismaService,

    private readonly outboxWriter: OutboxWriterService,

    private readonly urlBuilder: EmailVerificationUrlBuilder,
  ) {}

  async execute(
    input: ResendEmailVerificationInput,
  ): Promise<ResendEmailVerificationStatus> {
    try {
      return await this.prisma.$transaction(async (tx) =>
        this.executeTransaction(tx, input),
      );
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-resend-email-verification',

        resource: 'Email xác minh',
      });
    }
  }

  private async executeTransaction(
    tx: Prisma.TransactionClient,
    input: ResendEmailVerificationInput,
  ): Promise<ResendEmailVerificationStatus> {
    const user = await tx.user.findFirst({
      where: {
        email: {
          equals: input.email,
          mode: 'insensitive',
        },

        deletedAt: null,
      },

      select: {
        id: true,
        email: true,
        displayName: true,
        emailVerifiedAt: true,
      },
    });

    /*
     * Response bên ngoài luôn giống nhau.
     * Không tạo token/outbox khi user không tồn tại
     * hoặc đã xác minh email.
     */
    if (!user || user.emailVerifiedAt !== null) {
      return 'ignored';
    }

    /*
     * Vô hiệu hóa token xác minh email cũ.
     */
    await tx.userToken.updateMany({
      where: {
        userId: user.id,
        type: TokenType.EMAIL_VERIFICATION,
        consumedAt: null,
      },

      data: {
        consumedAt: new Date(),
      },
    });

    const verificationToken = await tx.userToken.create({
      data: {
        userId: user.id,
        type: TokenType.EMAIL_VERIFICATION,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },

      select: {
        id: true,
      },
    });

    const verificationUrl = this.urlBuilder.build(input.rawToken);

    const mailPayload = {
      version: 1,

      templateId: MailTemplateId.EMAIL_VERIFICATION,

      recipientEmail: user.email,

      variables: {
        displayName: user.displayName,
        verificationUrl,
        expiresInMinutes: input.expiresInMinutes,
      },
    } satisfies SendMailJobV1;

    await this.outboxWriter.create(tx, {
      aggregateType: 'user',
      aggregateId: user.id,
      eventType: SEND_MAIL_JOB,

      idempotencyKey: `email-verification-resend:${verificationToken.id}`,

      payload: mailPayload,
    });

    return 'queued';
  }
}
