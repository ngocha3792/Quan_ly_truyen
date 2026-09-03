import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import { ConfigService } from '@nestjs/config';

import type { AuthConfig } from '@/config';

import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  ManagedSessionRecord,
  RevokeOtherUserSessionsInput,
  RevokeUserSessionInput,
  SessionManagementPersistencePort,
} from '../../../../application/ports';

import { AuthAuditAction } from '../../../../domain/enums';

import { PrismaAuthAuditWriterAdapter } from '../../../audit';

@Injectable()
export class PrismaSessionManagementPersistence implements SessionManagementPersistencePort {
  private readonly listLimit: number;

  constructor(
    private readonly prisma: PrismaService,

    configService: ConfigService,

    private readonly auditWriter: PrismaAuthAuditWriterAdapter,
  ) {
    const config = configService.getOrThrow<AuthConfig>('auth');

    this.listLimit = config.sessions.listLimit;
  }

  async listActiveByUserId(
    userId: string,

    now: Date,
  ): Promise<readonly ManagedSessionRecord[]> {
    try {
      const sessions = await this.prisma.session.findMany({
        where: {
          userId,

          revokedAt: null,

          expiresAt: {
            gt: now,
          },
        },

        select: {
          id: true,

          deviceId: true,

          deviceName: true,

          ipAddress: true,

          userAgent: true,

          lastUsedAt: true,

          createdAt: true,

          expiresAt: true,

          trustedDevice: {
            select: { revokedAt: true, expiresAt: true },
          },
        },

        orderBy: [
          {
            lastUsedAt: 'desc',
          },

          {
            createdAt: 'desc',
          },
        ],

        take: this.listLimit,
      });
      return sessions.map(({ trustedDevice, ...session }) => ({
        ...session,
        trusted:
          trustedDevice !== null &&
          trustedDevice.revokedAt === null &&
          trustedDevice.expiresAt > now,
      }));
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-list-user-sessions',

        resource: 'Phiên đăng nhập',
      });
    }
  }

  async revokeOtherUserSessions(
    input: RevokeOtherUserSessionsInput,
  ): Promise<number> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        /*
         * Một UPDATE duy nhất cho tất cả session khác.
         *
         * actorSessionId là session hiện tại và luôn được giữ lại.
         *
         * Access token của các session bị revoke mất hiệu lực ngay vì
         * accessTokenVersion được increment.
         *
         * Refresh token cũng mất hiệu lực vì refreshTokenVersion
         * được increment đồng thời.
         */
        const result = await tx.session.updateMany({
          where: {
            userId: input.userId,

            id: {
              not: input.actorSessionId,
            },

            revokedAt: null,

            expiresAt: {
              gt: input.revokedAt,
            },
          },

          data: {
            revokedAt: input.revokedAt,

            revokedReason: input.reason,

            lastUsedAt: input.revokedAt,

            accessTokenVersion: {
              increment: 1,
            },

            refreshTokenVersion: {
              increment: 1,
            },
          },
        });

        /*
         * Chỉ ghi audit nếu thực sự có session bị revoke.
         *
         * Không tạo N audit record cho N session.
         * Một event bulk là đủ cho action "revoke all others".
         */
        if (result.count > 0) {
          await this.auditWriter.write(
            tx,

            {
              actorId: input.userId,

              actorSessionId: input.actorSessionId,

              action: AuthAuditAction.SESSION_REVOKED,

              entityType: 'user',

              entityId: input.userId,

              newValues: {
                revokedCount: result.count,

                revokedAt: input.revokedAt,

                revokedReason: input.reason,
              },

              metadata: {
                bulk: true,

                preservedSessionId: input.actorSessionId,
              },
            },
          );
        }

        return result.count;
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-revoke-other-user-sessions',

        resource: 'Phiên đăng nhập',
      });
    }
  }

  async revokeUserSession(input: RevokeUserSessionInput): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const session = await tx.session.findFirst({
          where: {
            id: input.sessionId,

            userId: input.userId,

            revokedAt: null,

            expiresAt: {
              gt: input.revokedAt,
            },
          },

          select: {
            id: true,

            deviceId: true,

            deviceName: true,
          },
        });

        if (!session) {
          return false;
        }

        const result = await tx.session.updateMany({
          where: {
            id: session.id,

            userId: input.userId,

            revokedAt: null,
          },

          data: {
            revokedAt: input.revokedAt,

            revokedReason: input.reason,

            lastUsedAt: input.revokedAt,

            accessTokenVersion: {
              increment: 1,
            },

            refreshTokenVersion: {
              increment: 1,
            },
          },
        });

        if (result.count !== 1) {
          return false;
        }

        await this.auditWriter.write(
          tx,

          {
            actorId: input.userId,

            actorSessionId: input.actorSessionId,

            action: AuthAuditAction.SESSION_REVOKED,

            entityType: 'session',

            entityId: session.id,

            oldValues: {
              status: 'active',

              revokedAt: null,
            },

            newValues: {
              status: 'revoked',

              revokedAt: input.revokedAt,

              revokedReason: input.reason,
            },

            metadata: {
              selfRevoked: input.actorSessionId === session.id,

              deviceId: session.deviceId,

              deviceName: session.deviceName,
            },
          },
        );

        return true;
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-revoke-user-session',

        resource: 'Phiên đăng nhập',
      });
    }
  }

  async setCurrentSessionTrusted(input: {
    userId: string;
    sessionId: string;
    trusted: boolean;
    changedAt: Date;
  }): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const session = await tx.session.findFirst({
          where: {
            id: input.sessionId,
            userId: input.userId,
            revokedAt: null,
            expiresAt: { gt: input.changedAt },
          },
          select: {
            id: true,
            deviceId: true,
            deviceName: true,
            userAgent: true,
            expiresAt: true,
            trustedDeviceId: true,
          },
        });
        if (!session) return false;

        if (!input.trusted) {
          if (!session.trustedDeviceId) return true;
          await tx.trustedDevice.updateMany({
            where: { id: session.trustedDeviceId, userId: input.userId, revokedAt: null },
            data: {
              revokedAt: input.changedAt,
              revokedReason: 'user_revoked',
              lastUsedAt: input.changedAt,
            },
          });
          await tx.session.updateMany({
            where: { userId: input.userId, trustedDeviceId: session.trustedDeviceId },
            data: { trustedDeviceId: null },
          });
          await this.auditWriter.write(tx, {
            actorId: input.userId,
            actorSessionId: input.sessionId,
            action: AuthAuditAction.DEVICE_TRUST_REVOKED,
            entityType: 'trusted_device',
            entityId: session.trustedDeviceId,
            newValues: { trusted: false, revokedAt: input.changedAt },
          });
          return true;
        }

        const deviceId = session.deviceId ?? session.id;
        const hash = (value: string): string =>
          createHash('sha256').update(value).digest('hex');
        const trustedDevice = await tx.trustedDevice.upsert({
          where: { userId_deviceId: { userId: input.userId, deviceId } },
          create: {
            userId: input.userId,
            deviceId,
            deviceName: session.deviceName,
            fingerprintHash: hash(`${input.userId}:${deviceId}:${session.userAgent ?? ''}`),
            trustTokenHash: hash(randomBytes(32).toString('base64url')),
            trustedAt: input.changedAt,
            lastUsedAt: input.changedAt,
            expiresAt: session.expiresAt,
          },
          update: {
            deviceName: session.deviceName,
            fingerprintHash: hash(`${input.userId}:${deviceId}:${session.userAgent ?? ''}`),
            trustTokenHash: hash(randomBytes(32).toString('base64url')),
            trustedAt: input.changedAt,
            lastUsedAt: input.changedAt,
            expiresAt: session.expiresAt,
            revokedAt: null,
            revokedReason: null,
          },
          select: { id: true },
        });
        await tx.session.update({
          where: { id: session.id },
          data: { deviceId, trustedDeviceId: trustedDevice.id },
        });
        await this.auditWriter.write(tx, {
          actorId: input.userId,
          actorSessionId: input.sessionId,
          action: AuthAuditAction.DEVICE_TRUSTED,
          entityType: 'trusted_device',
          entityId: trustedDevice.id,
          newValues: { trusted: true, expiresAt: session.expiresAt },
        });
        return true;
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-set-current-session-trusted',
        resource: 'Thiết bị tin cậy',
      });
    }
  }
}
