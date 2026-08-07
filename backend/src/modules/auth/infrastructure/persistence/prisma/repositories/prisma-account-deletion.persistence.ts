import { Injectable } from '@nestjs/common';

import {
  AccountDeletionStatus,
  AccountStatus,
  AuthorVerificationStatus,
  Prisma,
} from '@/generated/prisma/client';

import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  AccountDeletionCredentialRecord,
  AccountDeletionPersistencePort,
  DeleteAccountPersistenceInput,
  DeleteAccountPersistenceResult,
} from '../../../../application/ports';

import {
  AuthAuditAction,
  SessionRevocationReason,
} from '../../../../domain/enums';

import { AuthAuditWriterService } from '../../../audit';

@Injectable()
export class PrismaAccountDeletionPersistence implements AccountDeletionPersistencePort {
  constructor(
    private readonly prisma: PrismaService,

    private readonly auditWriter: AuthAuditWriterService,
  ) {}

  async findCredentialByUserId(
    userId: string,
  ): Promise<AccountDeletionCredentialRecord | null> {
    try {
      return await this.prisma.user.findFirst({
        where: {
          id: userId,

          deletedAt: null,

          status: AccountStatus.ACTIVE,
        },

        select: {
          passwordHash: true,
        },
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-find-account-deletion-credential',

        resource: 'Tài khoản người dùng',
      });
    }
  }

  async deleteAccount(
    input: DeleteAccountPersistenceInput,
  ): Promise<DeleteAccountPersistenceResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        /*
         * Sensitive action phải kiểm tra
         * current session vẫn còn hiệu lực
         * ngay trong transaction.
         */
        const currentSession = await tx.session.findFirst({
          where: {
            id: input.currentSessionId,

            userId: input.userId,

            revokedAt: null,

            expiresAt: {
              gt: input.deletedAt,
            },
          },

          select: {
            id: true,
          },
        });

        if (!currentSession) {
          return {
            status: 'current_session_unavailable',
          };
        }

        /*
         * Tạo identifiers mới để:
         *
         * - không giữ email/username thật;
         * - giải phóng email/username cũ để
         *   có thể đăng ký lại;
         * - vẫn giữ User row để các FK domain
         *   không bị phá.
         */
        const compactUserId = input.userId.replace(/-/g, '');

        const anonymizedEmail = `deleted+${compactUserId}@deleted.invalid`;

        const anonymizedUsername = `deleted_${compactUserId}`;

        /*
         * Compare-and-swap bằng passwordHash.
         *
         * Nếu password vừa được thay đổi sau
         * bước verify ở handler, không delete.
         */
        const deletedUser = await tx.user.updateMany({
          where: {
            id: input.userId,

            deletedAt: null,

            status: AccountStatus.ACTIVE,

            passwordHash: input.expectedPasswordHash,
          },

          data: {
            email: anonymizedEmail,

            username: anonymizedUsername,

            passwordHash: null,

            displayName: 'Người dùng đã xóa',

            bio: null,

            status: AccountStatus.DELETED,

            emailVerifiedAt: null,

            passwordUpdatedAt: null,

            lastLoginAt: null,

            avatarMediaId: null,

            deletedAt: input.deletedAt,
          },
        });

        if (deletedUser.count !== 1) {
          return {
            status: 'conflict',
          };
        }

        /*
         * AuthorProfile không thể hard-delete
         * vì Story.author dùng onDelete: Restrict.
         *
         * Vì vậy anonymize profile nhưng giữ
         * row để truyện cũ vẫn còn integrity.
         */
        await tx.authorProfile.updateMany({
          where: {
            userId: input.userId,
          },

          data: {
            penName: `deleted_${compactUserId}`,

            slug: `deleted-${compactUserId}`,

            biography: null,

            verificationStatus: AuthorVerificationStatus.PENDING,

            verifiedAt: null,

            websiteUrl: null,

            socialLinks: Prisma.DbNull,

            bannerMediaId: null,
          },
        });

        /*
         * Nếu user là contributor,
         * xóa creditName tự nhập và quyền edit.
         */
        await tx.storyContributor.updateMany({
          where: {
            userId: input.userId,
          },

          data: {
            creditName: null,

            canEdit: false,
          },
        });

        /*
         * Revoke TẤT CẢ session, kể cả
         * current session.
         *
         * Increment versions để cả access +
         * refresh token cũ mất hiệu lực.
         *
         * Đồng thời redaction metadata thiết bị.
         */
        const revokedSessions = await tx.session.updateMany({
          where: {
            userId: input.userId,

            revokedAt: null,
          },

          data: {
            revokedAt: input.deletedAt,

            revokedReason: SessionRevocationReason.ACCOUNT_DELETED,

            lastUsedAt: input.deletedAt,

            accessTokenVersion: {
              increment: 1,
            },

            refreshTokenVersion: {
              increment: 1,
            },

            trustedDeviceId: null,

            deviceId: null,

            deviceName: null,

            ipAddress: null,

            userAgent: null,
          },
        });

        /*
         * Xóa token một lần:
         *
         * - verify email
         * - reset password
         * - change email
         */
        await tx.userToken.deleteMany({
          where: {
            userId: input.userId,
          },
        });

        /*
         * OAuth identities.
         */
        await tx.oAuthAccount.deleteMany({
          where: {
            userId: input.userId,
          },
        });

        /*
         * MFA.
         *
         * MfaRecoveryCode cascade theo
         * MfaCredential.
         */
        await tx.adminMfaCredential.deleteMany({
          where: {
            userId: input.userId,
          },
        });

        await tx.mfaCredential.deleteMany({
          where: {
            userId: input.userId,
          },
        });

        /*
         * Recovery/security information.
         */
        await tx.recoveryEmail.deleteMany({
          where: {
            userId: input.userId,
          },
        });

        await tx.userSecurityQuestion.deleteMany({
          where: {
            userId: input.userId,
          },
        });

        await tx.trustedDevice.deleteMany({
          where: {
            userId: input.userId,
          },
        });

        /*
         * User không được giữ authorization
         * sau khi account bị delete.
         *
         * assignedById trên role của user khác
         * không đụng tới.
         */
        await tx.userRole.deleteMany({
          where: {
            userId: input.userId,
          },
        });

        /*
         * Notification là dữ liệu cá nhân,
         * có thể xóa an toàn mà không ảnh hưởng
         * counter/domain content.
         */
        await tx.notification.deleteMany({
          where: {
            userId: input.userId,
          },
        });

        await tx.notificationPreference.deleteMany({
          where: {
            userId: input.userId,
          },
        });

        /*
         * Nếu tương lai có flow schedule delete,
         * đóng request REQUESTED còn treo.
         */
        await tx.accountDeletionRequest.updateMany({
          where: {
            userId: input.userId,

            status: AccountDeletionStatus.REQUESTED,
          },

          data: {
            status: AccountDeletionStatus.CANCELED,

            canceledAt: input.deletedAt,
          },
        });

        /*
         * Endpoint hiện tại delete ngay,
         * nên request được ghi COMPLETED
         * ngay tại thời điểm request.
         */
        await tx.accountDeletionRequest.create({
          data: {
            userId: input.userId,

            status: AccountDeletionStatus.COMPLETED,

            requestedAt: input.deletedAt,

            scheduledFor: input.deletedAt,

            completedAt: input.deletedAt,

            requestIp: input.requestIp,

            requestUserAgent: input.requestUserAgent,
          },
        });

        /*
         * Không ghi email/password vào audit.
         */
        await this.auditWriter.write(tx, {
          actorId: input.userId,

          actorSessionId: input.currentSessionId,

          action: AuthAuditAction.ACCOUNT_DELETED,

          entityType: 'user',

          entityId: input.userId,

          newValues: {
            accountDeleted: true,

            anonymized: true,

            deletedAt: input.deletedAt,

            sessionsRevoked: revokedSessions.count,

            authenticationDataRemoved: true,
          },
        });

        return {
          status: 'deleted',

          sessionsRevoked: revokedSessions.count,

          deletedAt: input.deletedAt,
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-delete-account',

        resource: 'Tài khoản người dùng',
      });
    }
  }
}
