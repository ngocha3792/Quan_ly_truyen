import { Injectable } from '@nestjs/common';

import { TokenType } from '@/generated/prisma/client';

import { mapPrismaError, PrismaService } from '@/infrastructure/database';
import { AuthAuditAction } from '../../../../domain/enums';

import { AuthAuditWriterService } from '../../../audit';
import type {
  ChangePasswordPersistenceInput,
  ChangePasswordPersistencePort,
  ChangePasswordPersistenceResult,
  PasswordChangeCredentialRecord,
} from '../../../../application/ports';

import { SessionRevocationReason } from '../../../../domain/enums';

class CurrentSessionUnavailableError extends Error {
  constructor() {
    super('AUTH_CURRENT_SESSION_UNAVAILABLE');

    this.name = CurrentSessionUnavailableError.name;
  }
}

@Injectable()
export class PrismaChangePasswordPersistence implements ChangePasswordPersistencePort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuthAuditWriterService,
  ) {}

  async findCredentialByUserId(
    userId: string,
  ): Promise<PasswordChangeCredentialRecord | null> {
    try {
      return await this.prisma.user.findFirst({
        where: {
          id: userId,

          deletedAt: null,
        },

        select: {
          passwordHash: true,
        },
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-find-password-change-credential',

        resource: 'Thông tin xác thực',
      });
    }
  }

  async changePassword(
    input: ChangePasswordPersistenceInput,
  ): Promise<ChangePasswordPersistenceResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        /*
         * Compare-and-swap passwordHash.
         *
         * Nếu hai request đổi password chạy đồng
         * thời thì chỉ request đầu tiên thành công.
         */
        const changedUser = await tx.user.updateMany({
          where: {
            id: input.userId,

            deletedAt: null,

            passwordHash: input.expectedPasswordHash,
          },

          data: {
            passwordHash: input.nextPasswordHash,
          },
        });

        if (changedUser.count !== 1) {
          return {
            status: 'conflict',
          };
        }

        /*
         * Giữ current refresh token nhưng tăng
         * accessTokenVersion.
         *
         * Access token đang gọi endpoint này sẽ
         * mất hiệu lực ngay sau transaction.
         *
         * refreshTokenVersion KHÔNG được tăng.
         */
        const currentSession = await tx.session.updateMany({
          where: {
            id: input.currentSessionId,

            userId: input.userId,

            revokedAt: null,

            expiresAt: {
              gt: input.changedAt,
            },
          },

          data: {
            accessTokenVersion: {
              increment: 1,
            },

            lastUsedAt: input.changedAt,
          },
        });

        if (currentSession.count !== 1) {
          /*
           * Throw để rollback cả password update.
           */
          throw new CurrentSessionUnavailableError();
        }

        /*
         * Vô hiệu hóa toàn bộ password-reset token
         * chưa dùng.
         *
         * Nếu email reset cũ bị lộ, token đó không
         * thể đổi password thêm lần nữa.
         */
        await tx.userToken.updateMany({
          where: {
            userId: input.userId,

            type: TokenType.PASSWORD_RESET,

            consumedAt: null,
          },

          data: {
            consumedAt: input.changedAt,
          },
        });

        /*
         * Revoke tất cả session khác.
         *
         * Current session được giữ để client gọi
         * /auth/refresh lấy access token mới.
         */
        const revokedSessions = await tx.session.updateMany({
          where: {
            userId: input.userId,

            id: {
              not: input.currentSessionId,
            },

            revokedAt: null,

            expiresAt: {
              gt: input.changedAt,
            },
          },

          data: {
            revokedAt: input.changedAt,

            revokedReason: SessionRevocationReason.PASSWORD_CHANGED,

            lastUsedAt: input.changedAt,

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
            actorId: input.userId,

            actorSessionId: input.currentSessionId,

            action: AuthAuditAction.PASSWORD_CHANGED,

            entityType: 'user',

            entityId: input.userId,

            newValues: {
              passwordChanged: true,

              changedAt: input.changedAt,

              otherSessionsRevoked: revokedSessions.count,

              currentAccessTokenInvalidated: true,

              currentSessionKept: true,
            },
          },
        );

        return {
          status: 'changed',

          otherSessionsRevoked: revokedSessions.count,

          changedAt: input.changedAt,
        };
      });
    } catch (error: unknown) {
      if (error instanceof CurrentSessionUnavailableError) {
        return {
          status: 'current_session_unavailable',
        };
      }

      throw mapPrismaError(error, {
        operation: 'auth-change-password',

        resource: 'Mật khẩu người dùng',
      });
    }
  }
}
