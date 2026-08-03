import { Injectable } from '@nestjs/common';

import { AccountStatus } from '@/generated/prisma/client';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  RefreshSessionPersistencePort,
  RefreshSessionSnapshot,
  RevokeAllUserSessionsInput,
  RevokeCurrentSessionInput,
  RevokeRefreshTokenFamilyInput,
  RotateRefreshSessionInput,
} from '../../../../application/ports';
import { AuthAccountStatus, AuthAuditAction } from '../../../../domain/enums';
import { AuthAuditWriterService } from '../../../audit';

@Injectable()
export class PrismaRefreshSessionPersistence implements RefreshSessionPersistencePort {
  constructor(
    private readonly prisma: PrismaService,

    private readonly auditWriter: AuthAuditWriterService,
  ) {}
  async findBySessionId(
    sessionId: string,
  ): Promise<RefreshSessionSnapshot | null> {
    const session = await this.prisma.session.findUnique({
      where: {
        id: sessionId,
      },

      select: {
        id: true,
        userId: true,

        refreshTokenHash: true,
        refreshTokenFamilyId: true,
        refreshTokenVersion: true,
        accessTokenVersion: true,

        expiresAt: true,
        revokedAt: true,

        user: {
          select: {
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      userId: session.userId,

      refreshTokenHash: session.refreshTokenHash,

      refreshTokenFamilyId: session.refreshTokenFamilyId,

      refreshTokenVersion: session.refreshTokenVersion,

      accessTokenVersion: session.accessTokenVersion,

      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,

      accountStatus: session.user.status as AuthAccountStatus,

      userDeletedAt: session.user.deletedAt,
    };
  }

  async rotate(input: RotateRefreshSessionInput): Promise<boolean> {
    try {
      const result = await this.prisma.session.updateMany({
        where: {
          id: input.sessionId,
          userId: input.userId,

          refreshTokenFamilyId: input.familyId,

          refreshTokenHash: input.expectedRefreshTokenHash,

          refreshTokenVersion: input.expectedRefreshTokenVersion,

          revokedAt: null,

          expiresAt: {
            gt: input.rotatedAt,
          },

          user: {
            status: AccountStatus.ACTIVE,
            deletedAt: null,
          },
        },

        data: {
          refreshTokenHash: input.nextRefreshTokenHash,

          refreshTokenVersion: input.nextRefreshTokenVersion,

          lastUsedAt: input.rotatedAt,

          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });

      return result.count === 1;
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-rotate-refresh-token',
        resource: 'Phiên đăng nhập',
      });
    }
  }

  async revokeFamily(input: RevokeRefreshTokenFamilyInput): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const result = await tx.session.updateMany({
          where: {
            refreshTokenFamilyId: input.familyId,

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

        if (result.count === 0) {
          return;
        }

        await this.auditWriter.write(
          tx,

          {
            actorId: input.userId,

            actorSessionId: input.sessionId,

            action: AuthAuditAction.REFRESH_TOKEN_REUSE_DETECTED,

            entityType: 'session',

            entityId: input.sessionId,

            newValues: {
              status: 'revoked',

              revokedAt: input.revokedAt,

              revokedReason: input.reason,
            },

            metadata: {
              revokedFamilySessionCount: result.count,

              /*
               * Không ghi familyId vì đây là
               * security identifier không cần
               * expose trong audit history.
               */
              familyCompromised: true,
            },
          },
        );
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-revoke-refresh-token-family',

        resource: 'Phiên đăng nhập',
      });
    }
  }

  async revokeCurrentSession(input: RevokeCurrentSessionInput): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const result = await tx.session.updateMany({
          where: {
            id: input.sessionId,

            userId: input.userId,

            refreshTokenFamilyId: input.familyId,

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
          return;
        }

        await this.auditWriter.write(
          tx,

          {
            actorId: input.userId,

            actorSessionId: input.sessionId,

            action: AuthAuditAction.LOGOUT,

            entityType: 'session',

            entityId: input.sessionId,

            oldValues: {
              status: 'active',
            },

            newValues: {
              status: 'revoked',

              revokedAt: input.revokedAt,

              revokedReason: input.reason,
            },
          },
        );
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-logout-current-session',

        resource: 'Phiên đăng nhập',
      });
    }
  }
  async revokeAllUserSessions(
    input: RevokeAllUserSessionsInput,
  ): Promise<number> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const result = await tx.session.updateMany({
          where: {
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

        await this.auditWriter.write(
          tx,

          {
            actorId: input.userId,

            actorSessionId: input.actorSessionId,

            action: AuthAuditAction.LOGOUT_ALL,

            entityType: 'user',

            entityId: input.userId,

            newValues: {
              sessionsRevoked: result.count,

              revokedAt: input.revokedAt,

              revokedReason: input.reason,
            },
          },
        );

        return result.count;
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-logout-all-sessions',

        resource: 'Phiên đăng nhập',
      });
    }
  }
}
