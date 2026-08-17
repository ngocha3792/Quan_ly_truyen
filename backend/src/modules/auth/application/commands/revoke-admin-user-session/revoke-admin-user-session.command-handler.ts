import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '@/common/exceptions';
import { ADMIN_USER_SECURITY_PERSISTENCE_PORT, type AdminUserSecurityPersistencePort } from '../../ports';
import { RevokeAdminUserSessionCommand } from './revoke-admin-user-session.command';
@Injectable()
export class RevokeAdminUserSessionCommandHandler {
  constructor(@Inject(ADMIN_USER_SECURITY_PERSISTENCE_PORT) private readonly persistence: AdminUserSecurityPersistencePort) {
  }
  async execute(command: RevokeAdminUserSessionCommand): Promise<void> {
    const result = await this.persistence.revokeSession({ ...command, revokedAt: new Date() });
    if (result === 'not_found') throw new ResourceNotFoundException({ code: 'ADMIN_USER_SESSION_NOT_FOUND', resource: 'phiên đăng nhập', identifier: command.sessionId, message: 'Không tìm thấy phiên đăng nhập của người dùng' });
  }
}
