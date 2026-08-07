import { Injectable } from '@nestjs/common';

import { Prisma } from '@/generated/prisma/client';

import { isAppException } from '@/common/exceptions';

import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import { MailTemplateId } from '@/infrastructure/mail/templates';

import {
  SEND_MAIL_JOB,
  type SendMailJobV1,
} from '@/infrastructure/queue/contracts';

import { OutboxWriterService } from '@/infrastructure/queue/outbox';

import type {
  RecoveryEmailCredentialRecord,
  RecoveryEmailPersistencePort,
  RecoveryEmailStatusRecord,
  RemoveRecoveryEmailInput,
  RemoveRecoveryEmailResult,
  RequestRecoveryEmailInput,
  RequestRecoveryEmailResult,
  ResendRecoveryEmailInput,
  ResendRecoveryEmailResult,
  VerifyRecoveryEmailInput,
  VerifyRecoveryEmailResult,
} from '../../../../application/ports';

import { AuthAuditAction } from '../../../../domain/enums';

import { AuthAuditWriterService } from '../../../audit';

@Injectable()
export class PrismaRecoveryEmailPersistence implements RecoveryEmailPersistencePort {
  constructor(
    private readonly prisma: PrismaService,

    private readonly outboxWriter: OutboxWriterService,

    private readonly auditWriter: AuthAuditWriterService,
  ) {}

  async findCredentialByUserId(
    userId: string,
  ): Promise<RecoveryEmailCredentialRecord | null> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,

          deletedAt: null,
        },

        select: {
          email: true,

          passwordHash: true,
        },
      });

      if (!user) {
        return null;
      }

      return {
        primaryEmail: user.email,

        passwordHash: user.passwordHash,
      };
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-recovery-email-find-credential',

        resource: 'Email khôi phục',
      });
    }
  }

  async findStatusByUserId(
    userId: string,
  ): Promise<RecoveryEmailStatusRecord | null> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,

          deletedAt: null,
        },

        select: {
          recoveryEmail: {
            select: {
              email: true,

              verifiedAt: true,

              pendingEmail: true,

              pendingExpiresAt: true,
            },
          },
        },
      });

      if (!user) {
        return null;
      }

      return toStatus(user.recoveryEmail);
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-recovery-email-status',

        resource: 'Email khôi phục',
      });
    }
  }

  async request(
    input: RequestRecoveryEmailInput,
  ): Promise<RequestRecoveryEmailResult> {
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

            recoveryEmail: {
              select: {
                email: true,

                verifiedAt: true,

                pendingEmail: true,

                pendingExpiresAt: true,
              },
            },
          },
        });

        if (!user) {
          return {
            status: 'account_unavailable',
          };
        }

        if (
          user.email !== input.expectedPrimaryEmail ||
          user.passwordHash !== input.expectedPasswordHash
        ) {
          return {
            status: 'conflict',
          };
        }

        if (user.email.toLowerCase() === input.recoveryEmail.toLowerCase()) {
          return {
            status: 'same_as_primary',
          };
        }

        if (
          user.recoveryEmail?.email?.toLowerCase() ===
          input.recoveryEmail.toLowerCase()
        ) {
          return {
            status: 'same_as_current',
          };
        }

        const unavailable = await this.isEmailUnavailable(
          tx,

          input.userId,

          input.recoveryEmail,
        );

        if (unavailable) {
          return {
            status: 'email_in_use',
          };
        }

        const record = await tx.recoveryEmail.upsert({
          where: {
            userId: input.userId,
          },

          create: {
            userId: input.userId,

            pendingEmail: input.recoveryEmail,

            pendingCodeHash: input.codeHash,

            pendingRequestedAt: input.requestedAt,

            pendingExpiresAt: input.expiresAt,

            verificationSentAt: input.requestedAt,

            failedVerificationAttempts: 0,

            resendCount: 0,
          },

          update: {
            pendingEmail: input.recoveryEmail,

            pendingCodeHash: input.codeHash,

            pendingRequestedAt: input.requestedAt,

            pendingExpiresAt: input.expiresAt,

            verificationSentAt: input.requestedAt,

            failedVerificationAttempts: 0,

            resendCount: 0,
          },

          select: statusSelect,
        });

        await this.queueCodeEmail(
          tx,

          {
            operationId: input.operationId,

            userId: user.id,

            displayName: user.displayName,

            recipientEmail: input.recoveryEmail,

            rawCode: input.rawCode,

            expiresInMinutes: input.expiresInMinutes,
          },
        );

        await this.auditWriter.write(tx, {
          actorId: user.id,

          actorSessionId: input.currentSessionId,

          action: AuthAuditAction.RECOVERY_EMAIL_REQUESTED,

          entityType: 'recovery_email',

          entityId: user.id,

          oldValues: {
            email: user.recoveryEmail?.email ?? null,
          },

          newValues: {
            pendingEmail: input.recoveryEmail,

            expiresAt: input.expiresAt,
          },
        });

        return {
          status: 'requested',

          value: toStatus(record),
        };
      });
    } catch (error: unknown) {
      if (isAppException(error)) {
        throw error;
      }

      if (isUniqueConstraintError(error)) {
        return {
          status: 'email_in_use',
        };
      }

      throw mapPrismaError(error, {
        operation: 'auth-recovery-email-request',

        resource: 'Email khôi phục',
      });
    }
  }

  async verify(
    input: VerifyRecoveryEmailInput,
  ): Promise<VerifyRecoveryEmailResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const record = await tx.recoveryEmail.findUnique({
          where: {
            userId: input.userId,
          },

          select: {
            email: true,

            verifiedAt: true,

            pendingEmail: true,

            pendingCodeHash: true,

            pendingExpiresAt: true,

            failedVerificationAttempts: true,
          },
        });

        if (
          !record ||
          !record.pendingEmail ||
          !record.pendingCodeHash ||
          !record.pendingExpiresAt
        ) {
          return {
            status: 'no_pending',
          };
        }

        if (record.pendingExpiresAt <= input.verifiedAt) {
          return {
            status: 'expired',

            expiresAt: record.pendingExpiresAt,
          };
        }

        if (record.failedVerificationAttempts >= input.maxAttempts) {
          return {
            status: 'attempts_exceeded',
          };
        }

        if (record.pendingCodeHash !== input.codeHash) {
          const updated = await tx.recoveryEmail.updateMany({
            where: {
              userId: input.userId,

              pendingCodeHash: record.pendingCodeHash,

              failedVerificationAttempts: {
                lt: input.maxAttempts,
              },
            },

            data: {
              failedVerificationAttempts: {
                increment: 1,
              },
            },
          });

          if (updated.count !== 1) {
            return {
              status: 'attempts_exceeded',
            };
          }

          const fresh = await tx.recoveryEmail.findUnique({
            where: {
              userId: input.userId,
            },

            select: {
              failedVerificationAttempts: true,
            },
          });

          const attempts =
            fresh?.failedVerificationAttempts ?? input.maxAttempts;

          if (attempts >= input.maxAttempts) {
            return {
              status: 'attempts_exceeded',
            };
          }

          return {
            status: 'invalid',

            attemptsRemaining: Math.max(
              0,

              input.maxAttempts - attempts,
            ),
          };
        }

        const unavailable = await this.isEmailUnavailable(
          tx,

          input.userId,

          record.pendingEmail,
        );

        if (unavailable) {
          return {
            status: 'email_in_use',
          };
        }

        const claimed = await tx.recoveryEmail.updateMany({
          where: {
            userId: input.userId,

            pendingEmail: record.pendingEmail,

            pendingCodeHash: input.codeHash,

            pendingExpiresAt: {
              gt: input.verifiedAt,
            },

            failedVerificationAttempts: {
              lt: input.maxAttempts,
            },
          },

          data: {
            email: record.pendingEmail,

            verifiedAt: input.verifiedAt,

            pendingEmail: null,

            pendingCodeHash: null,

            pendingRequestedAt: null,

            pendingExpiresAt: null,

            verificationSentAt: null,

            failedVerificationAttempts: 0,

            resendCount: 0,
          },
        });

        if (claimed.count !== 1) {
          return {
            status: 'invalid',

            attemptsRemaining: 0,
          };
        }

        await this.auditWriter.write(tx, {
          actorId: input.userId,

          actorSessionId: input.currentSessionId,

          action: AuthAuditAction.RECOVERY_EMAIL_VERIFIED,

          entityType: 'recovery_email',

          entityId: input.userId,

          oldValues: {
            email: record.email,
          },

          newValues: {
            email: record.pendingEmail,

            verifiedAt: input.verifiedAt,
          },
        });

        return {
          status: 'verified',

          value: {
            email: record.pendingEmail,

            verifiedAt: input.verifiedAt,

            pendingEmail: null,

            pendingExpiresAt: null,
          },
        };
      });
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return {
          status: 'email_in_use',
        };
      }

      throw mapPrismaError(error, {
        operation: 'auth-recovery-email-verify',

        resource: 'Email khôi phục',
      });
    }
  }

  async resend(
    input: ResendRecoveryEmailInput,
  ): Promise<ResendRecoveryEmailResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const record = await tx.recoveryEmail.findUnique({
          where: {
            userId: input.userId,
          },

          select: {
            email: true,

            verifiedAt: true,

            pendingEmail: true,

            pendingCodeHash: true,

            verificationSentAt: true,

            resendCount: true,

            user: {
              select: {
                displayName: true,

                deletedAt: true,
              },
            },
          },
        });

        if (!record || record.user.deletedAt !== null || !record.pendingEmail) {
          return {
            status: 'no_pending',
          };
        }

        if (record.resendCount >= input.maxResends) {
          return {
            status: 'resend_limit',
          };
        }

        if (record.verificationSentAt) {
          const elapsed = Math.floor(
            (input.requestedAt.getTime() -
              record.verificationSentAt.getTime()) /
              1000,
          );

          const retryAfter = input.cooldownSeconds - elapsed;

          if (retryAfter > 0) {
            return {
              status: 'too_soon',

              retryAfterSeconds: retryAfter,
            };
          }
        }

        const unavailable = await this.isEmailUnavailable(
          tx,

          input.userId,

          record.pendingEmail,
        );

        if (unavailable) {
          return {
            status: 'email_in_use',
          };
        }

        const updated = await tx.recoveryEmail.updateMany({
          where: {
            userId: input.userId,

            pendingEmail: record.pendingEmail,

            resendCount: record.resendCount,
          },

          data: {
            pendingCodeHash: input.codeHash,

            pendingRequestedAt: input.requestedAt,

            pendingExpiresAt: input.expiresAt,

            verificationSentAt: input.requestedAt,

            failedVerificationAttempts: 0,

            resendCount: {
              increment: 1,
            },
          },
        });

        if (updated.count !== 1) {
          return {
            status: 'conflict',
          };
        }

        await this.queueCodeEmail(
          tx,

          {
            operationId: input.operationId,

            userId: input.userId,

            displayName: record.user.displayName,

            recipientEmail: record.pendingEmail,

            rawCode: input.rawCode,

            expiresInMinutes: input.expiresInMinutes,
          },
        );

        await this.auditWriter.write(tx, {
          actorId: input.userId,

          actorSessionId: input.currentSessionId,

          action: AuthAuditAction.RECOVERY_EMAIL_RESENT,

          entityType: 'recovery_email',

          entityId: input.userId,

          newValues: {
            pendingEmail: record.pendingEmail,

            expiresAt: input.expiresAt,

            resendCount: record.resendCount + 1,
          },
        });

        return {
          status: 'sent',

          value: {
            email: record.email,

            verifiedAt: record.verifiedAt,

            pendingEmail: record.pendingEmail,

            pendingExpiresAt: input.expiresAt,
          },
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-recovery-email-resend',

        resource: 'Email khôi phục',
      });
    }
  }

  async remove(
    input: RemoveRecoveryEmailInput,
  ): Promise<RemoveRecoveryEmailResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findFirst({
          where: {
            id: input.userId,

            deletedAt: null,
          },

          select: {
            passwordHash: true,

            recoveryEmail: {
              select: {
                email: true,

                pendingEmail: true,
              },
            },
          },
        });

        if (!user) {
          return {
            status: 'account_unavailable',
          };
        }

        if (user.passwordHash !== input.expectedPasswordHash) {
          return {
            status: 'conflict',
          };
        }

        await tx.recoveryEmail.deleteMany({
          where: {
            userId: input.userId,
          },
        });

        await this.auditWriter.write(tx, {
          actorId: input.userId,

          actorSessionId: input.currentSessionId,

          action: AuthAuditAction.RECOVERY_EMAIL_REMOVED,

          entityType: 'recovery_email',

          entityId: input.userId,

          oldValues: {
            email: user.recoveryEmail?.email ?? null,

            pendingEmail: user.recoveryEmail?.pendingEmail ?? null,
          },

          newValues: {
            email: null,

            pendingEmail: null,

            removedAt: input.removedAt,
          },
        });

        return {
          status: 'removed',

          value: {
            email: null,

            verifiedAt: null,

            pendingEmail: null,

            pendingExpiresAt: null,
          },
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-recovery-email-remove',

        resource: 'Email khôi phục',
      });
    }
  }

  private async isEmailUnavailable(
    tx: Prisma.TransactionClient,

    userId: string,

    email: string,
  ): Promise<boolean> {
    const [primaryOwner, recoveryOwner] = await Promise.all([
      tx.user.findFirst({
        where: {
          email: {
            equals: email,

            mode: 'insensitive',
          },
        },

        select: {
          id: true,
        },
      }),

      tx.recoveryEmail.findFirst({
        where: {
          userId: {
            not: userId,
          },

          OR: [
            {
              email: {
                equals: email,

                mode: 'insensitive',
              },
            },

            {
              pendingEmail: {
                equals: email,

                mode: 'insensitive',
              },
            },
          ],
        },

        select: {
          userId: true,
        },
      }),
    ]);

    return Boolean(primaryOwner || recoveryOwner);
  }

  private async queueCodeEmail(
    tx: Prisma.TransactionClient,

    input: {
      operationId: string;

      userId: string;

      displayName: string;

      recipientEmail: string;

      rawCode: string;

      expiresInMinutes: number;
    },
  ): Promise<void> {
    const payload = {
      version: 1,

      templateId: MailTemplateId.RECOVERY_EMAIL_CODE,

      recipientEmail: input.recipientEmail,

      variables: {
        displayName: input.displayName,

        code: input.rawCode,

        expiresInMinutes: input.expiresInMinutes,
      },
    } satisfies SendMailJobV1;

    await this.outboxWriter.create(
      tx,

      {
        aggregateType: 'mail',

        aggregateId: input.userId,

        eventType: SEND_MAIL_JOB,

        idempotencyKey: `recovery-email:${input.operationId}`,

        payload,
      },
    );
  }
}

const statusSelect = {
  email: true,

  verifiedAt: true,

  pendingEmail: true,

  pendingExpiresAt: true,
} satisfies Prisma.RecoveryEmailSelect;

function toStatus(
  value: {
    email: string | null;

    verifiedAt: Date | null;

    pendingEmail: string | null;

    pendingExpiresAt: Date | null;
  } | null,
): RecoveryEmailStatusRecord {
  return {
    email: value?.email ?? null,

    verifiedAt: value?.verifiedAt ?? null,

    pendingEmail: value?.pendingEmail ?? null,

    pendingExpiresAt: value?.pendingExpiresAt ?? null,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
