import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database';
import type {
  AdminUnlockIdentityRecord,
  AdminUserSecurityEventRecord,
  AdminUserSecurityPersistencePort,
  AdminUserSecuritySessionRecord,
} from '../../../../application';
import { PrismaAuthAuditWriterAdapter } from '../../../audit';

@Injectable()
export class PrismaAdminUserSecurityPersistence
  implements AdminUserSecurityPersistencePort
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: PrismaAuthAuditWriterAdapter,
  ) {}

  async userExists(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    return user !== null;
  }

  async listSessions(
    userId: string,
  ): Promise<readonly AdminUserSecuritySessionRecord[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: [
        { revokedAt: 'asc' },
        { lastUsedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 100,
      select: {
        id: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        deviceName: true,
        userAgent: true,
        ipAddress: true,
        revokedAt: true,
        revokedReason: true,
      },
    });

    return sessions.map((session) => ({
      sessionId: session.id,
      createdAt: session.createdAt,
      lastSeenAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      deviceName: session.deviceName,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      revoked: session.revokedAt !== null,
      revokedAt: session.revokedAt,
      revokedReason: session.revokedReason,
    }));
  }

  async revokeSession(input: {
    readonly actorUserId: string;
    readonly userId: string;
    readonly sessionId: string;
    readonly revokedAt: Date;
  }): Promise<'revoked' | 'already_revoked' | 'not_found'> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findFirst({
        where: { id: input.sessionId, userId: input.userId },
        select: { id: true, revokedAt: true },
      });
      if (!session) return 'not_found' as const;
      if (session.revokedAt) return 'already_revoked' as const;

      await tx.session.update({
        where: { id: session.id },
        data: {
          revokedAt: input.revokedAt,
          revokedReason: 'admin_revoked_session',
          accessTokenVersion: { increment: 1 },
          refreshTokenVersion: { increment: 1 },
        },
      });

      await this.auditWriter.write(tx, {
        actorId: input.actorUserId,
        action: 'USER_SESSION_REVOKED',
        entityType: 'user',
        entityId: input.userId,
        metadata: { sessionId: input.sessionId },
      });

      return 'revoked' as const;
    });
  }

  async revokeAllSessions(input: {
    readonly actorUserId: string;
    readonly userId: string;
    readonly revokedAt: Date;
  }): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.session.updateMany({
        where: { userId: input.userId, revokedAt: null },
        data: {
          revokedAt: input.revokedAt,
          revokedReason: 'admin_revoked_all_sessions',
          accessTokenVersion: { increment: 1 },
          refreshTokenVersion: { increment: 1 },
        },
      });

      await this.auditWriter.write(tx, {
        actorId: input.actorUserId,
        action: 'USER_ALL_SESSIONS_REVOKED',
        entityType: 'user',
        entityId: input.userId,
        metadata: { revokedCount: result.count },
      });

      return result.count;
    });
  }

  async findUnlockIdentity(
    userId: string,
  ): Promise<AdminUnlockIdentityRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { email: true, username: true, status: true },
    });
    return user
      ? { email: user.email, username: user.username, status: user.status }
      : null;
  }

  async writeUnlockAuditBestEffort(input: {
    readonly actorUserId: string;
    readonly userId: string;
    readonly accountStatus: string;
  }): Promise<void> {
    await this.auditWriter.writeBestEffort({
      actorId: input.actorUserId,
      action: 'USER_ACCOUNT_UNLOCKED',
      entityType: 'user',
      entityId: input.userId,
      metadata: { accountStatusUnchanged: input.accountStatus },
    });
  }

  async listSecurityEvents(input: {
    readonly userId: string;
    readonly actions: readonly string[];
  }): Promise<readonly AdminUserSecurityEventRecord[]> {
    return this.prisma.auditLog.findMany({
      where: {
        action: { in: [...input.actions] },
        OR: [
          { entityType: 'user', entityId: input.userId },
          { actorId: input.userId },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        action: true,
        ipAddress: true,
        userAgent: true,
        requestId: true,
        createdAt: true,
      },
    });
  }
}
