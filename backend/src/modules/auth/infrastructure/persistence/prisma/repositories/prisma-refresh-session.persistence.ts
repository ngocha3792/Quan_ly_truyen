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
import { AuthAccountStatus } from '../../../../domain/enums';

@Injectable()
export class PrismaRefreshSessionPersistence implements RefreshSessionPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

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
      await this.prisma.session.updateMany({
        where: {
          refreshTokenFamilyId: input.familyId,

          revokedAt: null,
        },

        data: {
          revokedAt: input.revokedAt,
          revokedReason: input.reason,
          lastUsedAt: input.revokedAt,

          /*
           * Vô hiệu hóa ngay access token đã phát.
           */
          accessTokenVersion: {
            increment: 1,
          },

          /*
           * Làm refresh token version hiện tại mất hiệu lực.
           */
          refreshTokenVersion: {
            increment: 1,
          },
        },
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
      /*
       * updateMany giúp logout idempotent:
       * - session không tồn tại => count = 0
       * - session đã revoke => count = 0
       * - không phát sinh exception
       */
      await this.prisma.session.updateMany({
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

          /*
           * Access token hiện tại mất hiệu lực ngay.
           */
          accessTokenVersion: {
            increment: 1,
          },

          /*
           * Refresh token hiện tại cũng mất hiệu lực.
           */
          refreshTokenVersion: {
            increment: 1,
          },
        },
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
      const result = await this.prisma.session.updateMany({
        where: {
          userId: input.userId,
          revokedAt: null,
        },

        data: {
          revokedAt: input.revokedAt,
          revokedReason: input.reason,
          lastUsedAt: input.revokedAt,

          /*
           * Vô hiệu hóa ngay mọi access token đã phát
           * từ tất cả session của user.
           */
          accessTokenVersion: {
            increment: 1,
          },

          /*
           * Vô hiệu hóa mọi refresh token hiện tại.
           */
          refreshTokenVersion: {
            increment: 1,
          },
        },
      });

      return result.count;
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-logout-all-sessions',
        resource: 'Phiên đăng nhập',
      });
    }
  }
}
