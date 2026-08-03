import { Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import type { AuthConfig } from '@/config';

import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  ManagedSessionRecord,
  RevokeUserSessionInput,
  SessionManagementPersistencePort,
} from '../../../../application/ports';

import { AuthAuditAction } from '../../../../domain/enums';

import { AuthAuditWriterService } from '../../../audit';

@Injectable()
export class PrismaSessionManagementPersistence implements SessionManagementPersistencePort {
  private readonly listLimit: number;

  constructor(
    private readonly prisma: PrismaService,

    configService: ConfigService,

    private readonly auditWriter: AuthAuditWriterService,
  ) {
    const config = configService.getOrThrow<AuthConfig>('auth');

    this.listLimit = config.sessions.listLimit;
  }

  async listActiveByUserId(
    userId: string,

    now: Date,
  ): Promise<readonly ManagedSessionRecord[]> {
    try {
      return await this.prisma.session.findMany({
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
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-list-user-sessions',

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
}
