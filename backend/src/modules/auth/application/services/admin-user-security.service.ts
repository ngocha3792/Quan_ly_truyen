import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '@/common/exceptions';
import {
  ADMIN_USER_SECURITY_PERSISTENCE_PORT,
  LOGIN_RATE_LIMITER_PORT,
  type AdminUserSecurityPersistencePort,
  type LoginRateLimiterPort,
} from '../ports';

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
    @Inject(ADMIN_USER_SECURITY_PERSISTENCE_PORT)
    private readonly persistence: AdminUserSecurityPersistencePort,
    @Inject(LOGIN_RATE_LIMITER_PORT)
    private readonly loginRateLimiter: LoginRateLimiterPort,
  ) {}

  async listSessions(userId: string): Promise<readonly AdminSessionView[]> {
    await this.assertUserExists(userId);
    return this.persistence.listSessions(userId);
  }

  async revokeSession(input: {
    actorUserId: string;
    userId: string;
    sessionId: string;
  }): Promise<void> {
    const result = await this.persistence.revokeSession({
      ...input,
      revokedAt: new Date(),
    });
    if (result === 'not_found') {
      throw new ResourceNotFoundException({
        code: 'ADMIN_USER_SESSION_NOT_FOUND',
        resource: 'phiên đăng nhập',
        identifier: input.sessionId,
        message: 'Không tìm thấy phiên đăng nhập của người dùng',
      });
    }
  }

  async revokeAllSessions(input: {
    actorUserId: string;
    userId: string;
  }): Promise<number> {
    await this.assertUserExists(input.userId);
    return this.persistence.revokeAllSessions({
      ...input,
      revokedAt: new Date(),
    });
  }

  async unlock(input: { actorUserId: string; userId: string }): Promise<void> {
    const user = await this.persistence.findUnlockIdentity(input.userId);
    if (!user) this.throwUserNotFound(input.userId);

    await Promise.all([
      this.loginRateLimiter.resetAfterSuccess({ identifier: user.email }),
      this.loginRateLimiter.resetAfterSuccess({ identifier: user.username }),
    ]);

    await this.persistence.writeUnlockAuditBestEffort({
      actorUserId: input.actorUserId,
      userId: input.userId,
      accountStatus: user.status,
    });
  }

  async listSecurityEvents(
    userId: string,
  ): Promise<readonly AdminSecurityEventView[]> {
    await this.assertUserExists(userId);
    return this.persistence.listSecurityEvents({
      userId,
      actions: SECURITY_ACTIONS,
    });
  }

  private async assertUserExists(userId: string): Promise<void> {
    if (!(await this.persistence.userExists(userId))) {
      this.throwUserNotFound(userId);
    }
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
