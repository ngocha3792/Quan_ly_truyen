import { Injectable } from '@nestjs/common';

import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  ManagedSessionRecord,
  RevokeUserSessionInput,
  SessionManagementPersistencePort,
} from '../../../../application/ports';

@Injectable()
export class PrismaSessionManagementPersistence implements SessionManagementPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

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

        /*
         * Một user bình thường không nên có quá nhiều
         * session. Giới hạn này tránh trả dữ liệu vô hạn.
         */
        take: 100,
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
      const result = await this.prisma.session.updateMany({
        where: {
          id: input.sessionId,
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

      return result.count === 1;
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'auth-revoke-user-session',

        resource: 'Phiên đăng nhập',
      });
    }
  }
}
