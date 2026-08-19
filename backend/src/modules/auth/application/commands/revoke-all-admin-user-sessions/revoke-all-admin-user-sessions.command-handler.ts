import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '@/common/exceptions';
import {
  ADMIN_USER_SECURITY_PERSISTENCE_PORT,
  type AdminUserSecurityPersistencePort,
} from '../../ports';
import { RevokeAllAdminUserSessionsCommand } from './revoke-all-admin-user-sessions.command';
@Injectable()
export class RevokeAllAdminUserSessionsCommandHandler {
  constructor(
    @Inject(ADMIN_USER_SECURITY_PERSISTENCE_PORT)
    private readonly persistence: AdminUserSecurityPersistencePort,
  ) {}
  async execute(command: RevokeAllAdminUserSessionsCommand): Promise<number> {
    if (!(await this.persistence.userExists(command.userId)))
      throw new ResourceNotFoundException({
        code: 'ADMIN_USER_SECURITY_USER_NOT_FOUND',
        resource: 'người dùng',
        identifier: command.userId,
        message: 'Không tìm thấy người dùng cần quản lý bảo mật',
      });
    return this.persistence.revokeAllSessions({
      ...command,
      revokedAt: new Date(),
    });
  }
}
