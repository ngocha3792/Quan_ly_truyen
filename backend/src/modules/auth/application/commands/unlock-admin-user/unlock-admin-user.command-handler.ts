import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '@/common/exceptions';
import {
  ADMIN_USER_SECURITY_PERSISTENCE_PORT,
  LOGIN_RATE_LIMITER_PORT,
  type AdminUserSecurityPersistencePort,
  type LoginRateLimiterPort,
} from '../../ports';
import { UnlockAdminUserCommand } from './unlock-admin-user.command';
@Injectable()
export class UnlockAdminUserCommandHandler {
  constructor(
    @Inject(ADMIN_USER_SECURITY_PERSISTENCE_PORT)
    private readonly persistence: AdminUserSecurityPersistencePort,
    @Inject(LOGIN_RATE_LIMITER_PORT)
    private readonly limiter: LoginRateLimiterPort,
  ) {}
  async execute(command: UnlockAdminUserCommand): Promise<void> {
    const user = await this.persistence.findUnlockIdentity(command.userId);
    if (!user)
      throw new ResourceNotFoundException({
        code: 'ADMIN_USER_SECURITY_USER_NOT_FOUND',
        resource: 'người dùng',
        identifier: command.userId,
        message: 'Không tìm thấy người dùng cần quản lý bảo mật',
      });
    await Promise.all([
      this.limiter.resetAfterSuccess({ identifier: user.email }),
      this.limiter.resetAfterSuccess({ identifier: user.username }),
    ]);
    await this.persistence.writeUnlockAuditBestEffort({
      actorUserId: command.actorUserId,
      userId: command.userId,
      accountStatus: user.status,
    });
  }
}
