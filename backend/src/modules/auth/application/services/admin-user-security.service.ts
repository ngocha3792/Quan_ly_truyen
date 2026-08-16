import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '@/common/exceptions';
import { PrismaService } from '@/infrastructure/database';
import { LOGIN_RATE_LIMITER_PORT, type LoginRateLimiterPort } from '../ports';
import { AuthAuditWriterService } from '../../infrastructure/audit';

const SECURITY_ACTIONS = [
  'auth.login.succeeded',
  'auth.login.failed',
  'auth.account.locked',
  'USER_ACCOUNT_UNLOCKED',
  'auth.mfa.enrolled',
  'auth.mfa.disabled',
  'auth.session.revoked',
  'auth.logout_all',
  'USER_SESSION_REVOKED',
  'USER_ALL_SESSIONS_REVOKED',
  'USER_STATUS_CHANGED',
  'USER_ROLE_ADDED',
  'USER_ROLE_REMOVED',
  'auth.password.changed',
  'auth.password.reset',
] as const;
export interface AdminSessionView {
  sessionId: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  expiresAt: Date;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  revoked: boolean;
  revokedAt: Date | null;
  revokedReason: string | null;
}
export interface AdminSecurityEventView {
  id: string;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: Date;
}
@Injectable()
export class AdminUserSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(LOGIN_RATE_LIMITER_PORT)
    private readonly loginRateLimiter: LoginRateLimiterPort,
    private readonly auditWriter: AuthAuditWriterService,
  ) {}
  async listSessions(userId: string): Promise<readonly AdminSessionView[]> {
    await this.assertUserExists(userId);
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
    return sessions.map((s) => ({
      sessionId: s.id,
      createdAt: s.createdAt,
      lastSeenAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
      deviceName: s.deviceName,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      revoked: s.revokedAt !== null,
      revokedAt: s.revokedAt,
      revokedReason: s.revokedReason,
    }));
  }
  async revokeSession(input: {
    actorUserId: string;
    userId: string;
    sessionId: string;
  }): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findFirst({
        where: { id: input.sessionId, userId: input.userId },
        select: { id: true, revokedAt: true },
      });
      if (!session)
        throw new ResourceNotFoundException({
          code: 'ADMIN_USER_SESSION_NOT_FOUND',
          resource: 'phiên đăng nhập',
          identifier: input.sessionId,
          message: 'Không tìm thấy phiên đăng nhập của người dùng',
        });
      if (session.revokedAt) return;
      await tx.session.update({
        where: { id: session.id },
        data: {
          revokedAt: now,
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
    });
  }
  async revokeAllSessions(input: {
    actorUserId: string;
    userId: string;
  }): Promise<number> {
    await this.assertUserExists(input.userId);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.session.updateMany({
        where: { userId: input.userId, revokedAt: null },
        data: {
          revokedAt: now,
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
  async unlock(input: { actorUserId: string; userId: string }): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: input.userId, deletedAt: null },
      select: { id: true, email: true, username: true, status: true },
    });
    if (!user) this.throwUserNotFound(input.userId);
    await Promise.all([
      this.loginRateLimiter.resetAfterSuccess({ identifier: user.email }),
      this.loginRateLimiter.resetAfterSuccess({ identifier: user.username }),
    ]);
    await this.auditWriter.writeBestEffort({
      actorId: input.actorUserId,
      action: 'USER_ACCOUNT_UNLOCKED',
      entityType: 'user',
      entityId: input.userId,
      metadata: { accountStatusUnchanged: user.status },
    });
  }
  async listSecurityEvents(
    userId: string,
  ): Promise<readonly AdminSecurityEventView[]> {
    await this.assertUserExists(userId);
    return this.prisma.auditLog.findMany({
      where: {
        action: { in: [...SECURITY_ACTIONS] },
        OR: [{ entityType: 'user', entityId: userId }, { actorId: userId }],
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
  private async assertUserExists(userId: string): Promise<void> {
    const exists = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) this.throwUserNotFound(userId);
  }
  private throwUserNotFound(userId: string): never {
    throw new ResourceNotFoundException({
      code: 'ADMIN_USER_SECURITY_USER_NOT_FOUND',
      resource: 'người dùng',
      identifier: userId,
      message: 'Không tìm thấy người dùng cần quản lý bảo mật',
    });
  }
}
