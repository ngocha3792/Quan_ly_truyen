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
  PasswordResetPersistencePort,
  RequestPasswordResetInput,
  RequestPasswordResetStatus,
  ResetPasswordInput,
  ResetPasswordPersistenceResult,
} from '../../../../application/ports';
import { SessionRevocationReason } from '../../../../domain/enums';
import { PasswordResetUrlBuilder } from '../../../mail';

@Injectable()
export class PrismaPasswordResetPersistence implements PasswordResetPersistencePort {
  constructor(
    private readonly prisma: PrismaService,

    private readonly outboxWriter: OutboxWriterService,

    private readonly resetUrlBuilder: PasswordResetUrlBuilder,
  ) {}

  async request(
    input: RequestPasswordResetInput,
  ): Promise<RequestPasswordResetStatus> {
    const resetUrl = this.resetUrlBuilder.build(input.rawToken);

    try {
      return await this.prisma.$transaction(async (tx) =>
        this.createResetRequest(tx, input, resetUrl),
      );
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-request-password-reset',

        resource: 'Yêu cầu đặt lại mật khẩu',
      });
    }
  }

  async reset(
    input: ResetPasswordInput,
  ): Promise<ResetPasswordPersistenceResult> {
    try {
      return await this.prisma.$transaction(async (tx) =>
        this.resetPasswordTransaction(tx, input),
      );
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-reset-password',

        resource: 'Đặt lại mật khẩu',
      });
    }
  }

  private async createResetRequest(
    tx: Prisma.TransactionClient,
    input: RequestPasswordResetInput,
    resetUrl: string,
  ): Promise<RequestPasswordResetStatus> {
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
      },
    });

    /*
     * Không tiết lộ email có tồn tại hay không.
     */
    if (!user) {
      return 'ignored';
    }

    const now = new Date();

    /*
     * Vô hiệu hóa mọi reset token cũ.
     */
    await tx.userToken.updateMany({
      where: {
        userId: user.id,
        type: TokenType.PASSWORD_RESET,
        consumedAt: null,
      },

      data: {
        consumedAt: now,
      },
    });

    const resetToken = await tx.userToken.create({
      data: {
        userId: user.id,
        type: TokenType.PASSWORD_RESET,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },

      select: {
        id: true,
      },
    });

    const mailPayload = {
      version: 1,

      templateId: MailTemplateId.PASSWORD_RESET,

      recipientEmail: user.email,

      variables: {
        displayName: user.displayName,

        resetUrl,

        expiresInMinutes: input.expiresInMinutes,
      },
    } satisfies SendMailJobV1;

    await this.outboxWriter.create(tx, {
      aggregateType: 'user',

      aggregateId: user.id,

      eventType: SEND_MAIL_JOB,

      idempotencyKey: `password-reset:${resetToken.id}`,

      payload: mailPayload,
    });

    return 'queued';
  }

  private async resetPasswordTransaction(
    tx: Prisma.TransactionClient,
    input: ResetPasswordInput,
  ): Promise<ResetPasswordPersistenceResult> {
    const token = await tx.userToken.findUnique({
      where: {
        tokenHash: input.tokenHash,
      },

      select: {
        id: true,
        userId: true,
        type: true,
        expiresAt: true,
        consumedAt: true,

        user: {
          select: {
            id: true,
            email: true,
            deletedAt: true,
          },
        },
      },
    });

    if (
      !token ||
      token.type !== TokenType.PASSWORD_RESET ||
      token.user.deletedAt !== null
    ) {
      return {
        status: 'invalid',
      };
    }

    if (token.expiresAt <= input.resetAt) {
      return {
        status: 'expired',

        expiresAt: token.expiresAt,
      };
    }

    if (token.consumedAt !== null) {
      return {
        status: 'invalid',
      };
    }

    /*
     * Compare-and-swap:
     * chỉ một request được consume token.
     */
    const claimedToken = await tx.userToken.updateMany({
      where: {
        id: token.id,

        type: TokenType.PASSWORD_RESET,

        consumedAt: null,

        expiresAt: {
          gt: input.resetAt,
        },
      },

      data: {
        consumedAt: input.resetAt,
      },
    });

    if (claimedToken.count !== 1) {
      return {
        status: 'invalid',
      };
    }

    await tx.user.update({
      where: {
        id: token.userId,
      },

      data: {
        passwordHash: input.passwordHash,
      },
    });

    /*
     * Consume mọi reset token còn lại.
     */
    await tx.userToken.updateMany({
      where: {
        userId: token.userId,

        type: TokenType.PASSWORD_RESET,

        consumedAt: null,
      },

      data: {
        consumedAt: input.resetAt,
      },
    });

    /*
     * Revoke toàn bộ session để access token và
     * refresh token trên mọi thiết bị mất hiệu lực.
     */
    const revokedSessions = await tx.session.updateMany({
      where: {
        userId: token.userId,
        revokedAt: null,
      },

      data: {
        revokedAt: input.resetAt,

        revokedReason: SessionRevocationReason.PASSWORD_RESET,

        lastUsedAt: input.resetAt,

        accessTokenVersion: {
          increment: 1,
        },

        refreshTokenVersion: {
          increment: 1,
        },
      },
    });

    return {
      status: 'reset',

      userId: token.user.id,

      email: token.user.email,

      sessionsRevoked: revokedSessions.count,

      resetAt: input.resetAt,
    };
  }
}
