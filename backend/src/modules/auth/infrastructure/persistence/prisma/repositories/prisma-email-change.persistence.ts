import { Injectable } from '@nestjs/common';

import { AuthAuditAction } from '../../../../domain/enums';

import { AuthAuditWriterService } from '../../../audit';
import { Prisma, TokenType } from '@/generated/prisma/client';

import { isAppException } from '@/common/exceptions';

import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import { MailTemplateId } from '@/infrastructure/mail/templates';

import {
  SEND_MAIL_JOB,
  type SendMailJobV1,
} from '@/infrastructure/queue/contracts';

import { OutboxWriterService } from '@/infrastructure/queue/outbox';

import type {
  ConfirmEmailChangeInput,
  ConfirmEmailChangePersistenceResult,
  EmailChangeCredentialRecord,
  EmailChangePersistencePort,
  RequestEmailChangeInput,
  RequestEmailChangePersistenceResult,
} from '../../../../application/ports';

import { SessionRevocationReason } from '../../../../domain/enums';

import { ChangeEmailUrlBuilder } from '../../../mail';

interface ChangeEmailTokenPayloadV1 {
  version: 1;

  currentEmail: string;

  newEmail: string;
}

@Injectable()
export class PrismaEmailChangePersistence implements EmailChangePersistencePort {
  constructor(
    private readonly prisma: PrismaService,

    private readonly outboxWriter: OutboxWriterService,

    private readonly urlBuilder: ChangeEmailUrlBuilder,
    private readonly auditWriter: AuthAuditWriterService,
  ) {}

  async findCredentialByUserId(
    userId: string,
  ): Promise<EmailChangeCredentialRecord | null> {
    try {
      return await this.prisma.user.findFirst({
        where: {
          id: userId,

          deletedAt: null,
        },

        select: {
          email: true,

          passwordHash: true,
        },
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-find-email-change-credential',

        resource: 'Thông tin tài khoản',
      });
    }
  }

  async request(
    input: RequestEmailChangeInput,
  ): Promise<RequestEmailChangePersistenceResult> {
    const confirmationUrl = this.urlBuilder.build(input.rawToken);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findFirst({
          where: {
            id: input.userId,

            deletedAt: null,
          },

          select: {
            id: true,

            email: true,

            passwordHash: true,

            displayName: true,
          },
        });

        if (!user) {
          return {
            status: 'account_unavailable',
          };
        }

        /*
         * Compare state đã được handler kiểm tra.
         *
         * Ngăn request sử dụng password/email
         * snapshot đã cũ.
         */
        if (
          user.email !== input.expectedCurrentEmail ||
          user.passwordHash !== input.expectedPasswordHash
        ) {
          return {
            status: 'conflict',
          };
        }

        if (user.email.toLowerCase() === input.newEmail.toLowerCase()) {
          return {
            status: 'same_email',
          };
        }

        /*
         * Không lọc deletedAt.
         *
         * Email của soft-deleted user vẫn bị
         * unique constraint giữ lại.
         */
        const owner = await tx.user.findFirst({
          where: {
            id: {
              not: user.id,
            },

            email: {
              equals: input.newEmail,

              mode: 'insensitive',
            },
          },

          select: {
            id: true,
          },
        });

        if (owner) {
          return {
            status: 'email_in_use',

            email: input.newEmail,
          };
        }

        /*
         * Mỗi user chỉ có một yêu cầu đổi email
         * đang hoạt động.
         */
        await tx.userToken.updateMany({
          where: {
            userId: user.id,

            type: TokenType.CHANGE_EMAIL,

            consumedAt: null,
          },

          data: {
            consumedAt: input.requestedAt,
          },
        });

        const token = await tx.userToken.create({
          data: {
            userId: user.id,

            type: TokenType.CHANGE_EMAIL,

            tokenHash: input.tokenHash,

            payload: {
              version: 1,

              currentEmail: user.email,

              newEmail: input.newEmail,
            } satisfies ChangeEmailTokenPayloadV1,

            expiresAt: input.expiresAt,
          },

          select: {
            id: true,
          },
        });

        const mailPayload = {
          version: 1,

          templateId: MailTemplateId.CHANGE_EMAIL,

          recipientEmail: input.newEmail,

          variables: {
            displayName: user.displayName,

            confirmationUrl,

            currentEmail: user.email,

            newEmail: input.newEmail,

            expiresInMinutes: input.expiresInMinutes,
          },
        } satisfies SendMailJobV1;

        /*
         * OutboxWriterService của phase trước sẽ
         * mã hóa toàn bộ mail payload.
         */
        await this.outboxWriter.create(
          tx,

          {
            aggregateType: 'mail',

            aggregateId: user.id,

            eventType: SEND_MAIL_JOB,

            idempotencyKey: `change-email:${token.id}`,

            payload: mailPayload,
          },
        );

        await this.auditWriter.write(
          tx,

          {
            actorId: user.id,

            action: AuthAuditAction.EMAIL_CHANGE_REQUESTED,

            entityType: 'user',

            entityId: user.id,

            oldValues: {
              email: user.email,
            },

            newValues: {
              pendingEmail: input.newEmail,

              expiresAt: input.expiresAt,
            },

            metadata: {
              verificationRequired: true,
            },
          },
        );

        return {
          status: 'requested',

          currentEmail: user.email,

          newEmail: input.newEmail,

          expiresAt: input.expiresAt,
        };
      });
    } catch (error: unknown) {
      if (isAppException(error)) {
        throw error;
      }

      if (isUniqueConstraintError(error)) {
        return {
          status: 'email_in_use',

          email: input.newEmail,
        };
      }

      throw mapPrismaError(error, {
        operation: 'auth-request-email-change',

        resource: 'Yêu cầu thay đổi email',
      });
    }
  }

  async confirm(
    input: ConfirmEmailChangeInput,
  ): Promise<ConfirmEmailChangePersistenceResult> {
    let candidateEmail: string | undefined;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const token = await tx.userToken.findUnique({
          where: {
            tokenHash: input.tokenHash,
          },

          select: {
            id: true,

            userId: true,

            type: true,

            payload: true,

            expiresAt: true,

            consumedAt: true,

            user: {
              select: {
                id: true,

                email: true,

                emailVerifiedAt: true,

                deletedAt: true,
              },
            },
          },
        });

        if (
          !token ||
          token.type !== TokenType.CHANGE_EMAIL ||
          token.user.deletedAt !== null
        ) {
          return {
            status: 'invalid',
          };
        }

        const payload = parseChangeEmailPayload(token.payload);

        if (!payload) {
          return {
            status: 'invalid',
          };
        }

        candidateEmail = payload.newEmail;

        /*
         * Token đã được consume bởi request
         * thành công trước đó.
         */
        if (token.consumedAt !== null) {
          if (
            token.user.email.toLowerCase() === payload.newEmail.toLowerCase()
          ) {
            return {
              status: 'already_changed',

              previousEmail: payload.currentEmail,

              email: payload.newEmail,

              changedAt: token.user.emailVerifiedAt ?? token.consumedAt,

              sessionsRevoked: 0,
            };
          }

          return {
            status: 'invalid',
          };
        }

        if (token.expiresAt <= input.confirmedAt) {
          return {
            status: 'expired',

            expiresAt: token.expiresAt,
          };
        }

        const existingOwner = await tx.user.findFirst({
          where: {
            id: {
              not: token.userId,
            },

            email: {
              equals: payload.newEmail,

              mode: 'insensitive',
            },
          },

          select: {
            id: true,
          },
        });

        if (existingOwner) {
          return {
            status: 'email_in_use',

            email: payload.newEmail,
          };
        }

        /*
         * Chỉ một request được claim token.
         */
        const claimed = await tx.userToken.updateMany({
          where: {
            id: token.id,

            type: TokenType.CHANGE_EMAIL,

            consumedAt: null,

            expiresAt: {
              gt: input.confirmedAt,
            },
          },

          data: {
            consumedAt: input.confirmedAt,
          },
        });

        if (claimed.count !== 1) {
          return this.resolveConcurrentConfirmation(
            tx,

            token.id,

            payload,

            input.confirmedAt,
          );
        }

        /*
         * CAS bằng currentEmail trong token.
         *
         * Token cũ không thể đổi email nếu email
         * user đã thay đổi bởi một request khác.
         */
        const changed = await tx.user.updateMany({
          where: {
            id: token.userId,

            deletedAt: null,

            email: payload.currentEmail,
          },

          data: {
            email: payload.newEmail,

            /*
             * Email mới đã được xác minh bằng
             * chính link gửi tới email đó.
             */
            emailVerifiedAt: input.confirmedAt,
          },
        });

        if (changed.count !== 1) {
          return this.resolveConcurrentConfirmation(
            tx,

            token.id,

            payload,

            input.confirmedAt,
          );
        }

        /*
         * Vô hiệu hóa:
         *
         * - mọi change-email token khác;
         * - password-reset token đã gửi tới email cũ;
         * - email-verification token cũ.
         */
        await tx.userToken.updateMany({
          where: {
            userId: token.userId,

            type: {
              in: [
                TokenType.CHANGE_EMAIL,

                TokenType.PASSWORD_RESET,

                TokenType.EMAIL_VERIFICATION,
              ],
            },

            consumedAt: null,
          },

          data: {
            consumedAt: input.confirmedAt,
          },
        });

        /*
         * Confirm endpoint là public và có thể
         * được mở ở thiết bị khác.
         *
         * Vì vậy revoke toàn bộ session thay vì
         * cố giữ một current session không xác định.
         */
        const revokedSessions = await tx.session.updateMany({
          where: {
            userId: token.userId,

            revokedAt: null,

            expiresAt: {
              gt: input.confirmedAt,
            },
          },

          data: {
            revokedAt: input.confirmedAt,

            revokedReason: SessionRevocationReason.EMAIL_CHANGED,

            lastUsedAt: input.confirmedAt,

            accessTokenVersion: {
              increment: 1,
            },

            refreshTokenVersion: {
              increment: 1,
            },
          },
        });

        await this.auditWriter.write(
          tx,

          {
            actorId: token.userId,

            action: AuthAuditAction.EMAIL_CHANGED,

            entityType: 'user',

            entityId: token.userId,

            oldValues: {
              email: payload.currentEmail,
            },

            newValues: {
              email: payload.newEmail,

              emailVerified: true,

              changedAt: input.confirmedAt,

              sessionsRevoked: revokedSessions.count,
            },

            metadata: {
              reauthenticationRequired: true,
            },
          },
        );

        return {
          status: 'changed',

          previousEmail: payload.currentEmail,

          email: payload.newEmail,

          changedAt: input.confirmedAt,

          sessionsRevoked: revokedSessions.count,
        };
      });
    } catch (error: unknown) {
      /*
       * Hai user có thể confirm cùng một email
       * gần như đồng thời.
       *
       * Database unique constraint là lớp bảo vệ
       * cuối cùng.
       */
      if (candidateEmail && isUniqueConstraintError(error)) {
        return {
          status: 'email_in_use',

          email: candidateEmail,
        };
      }

      throw mapPrismaError(error, {
        operation: 'auth-confirm-email-change',

        resource: 'Xác nhận thay đổi email',
      });
    }
  }

  private async resolveConcurrentConfirmation(
    tx: Prisma.TransactionClient,

    tokenId: string,

    payload: ChangeEmailTokenPayloadV1,

    confirmedAt: Date,
  ): Promise<ConfirmEmailChangePersistenceResult> {
    const [freshUser, freshToken] = await Promise.all([
      tx.user.findUnique({
        where: {
          email: payload.newEmail,
        },

        select: {
          id: true,

          email: true,

          emailVerifiedAt: true,

          deletedAt: true,
        },
      }),

      tx.userToken.findUnique({
        where: {
          id: tokenId,
        },

        select: {
          expiresAt: true,

          consumedAt: true,

          userId: true,
        },
      }),
    ]);

    if (
      freshUser &&
      freshToken &&
      freshUser.id === freshToken.userId &&
      freshUser.deletedAt === null &&
      freshUser.email.toLowerCase() === payload.newEmail.toLowerCase()
    ) {
      return {
        status: 'already_changed',

        previousEmail: payload.currentEmail,

        email: payload.newEmail,

        changedAt:
          freshUser.emailVerifiedAt ?? freshToken.consumedAt ?? confirmedAt,

        sessionsRevoked: 0,
      };
    }

    if (freshToken && freshToken.expiresAt <= confirmedAt) {
      return {
        status: 'expired',

        expiresAt: freshToken.expiresAt,
      };
    }

    return {
      status: 'invalid',
    };
  }
}

function parseChangeEmailPayload(
  value: Prisma.JsonValue,
): ChangeEmailTokenPayloadV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as Record<string, unknown>;

  if (
    payload.version !== 1 ||
    typeof payload.currentEmail !== 'string' ||
    typeof payload.newEmail !== 'string'
  ) {
    return null;
  }

  const currentEmail = payload.currentEmail.trim().toLowerCase();

  const newEmail = payload.newEmail.trim().toLowerCase();

  if (!currentEmail || !newEmail || currentEmail === newEmail) {
    return null;
  }

  return {
    version: 1,

    currentEmail,

    newEmail,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
