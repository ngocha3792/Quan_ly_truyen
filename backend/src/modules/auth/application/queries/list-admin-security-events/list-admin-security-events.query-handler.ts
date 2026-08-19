import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '@/common/exceptions';
import type { AdminSecurityEventView } from '../../dto';
import {
  ADMIN_USER_SECURITY_PERSISTENCE_PORT,
  type AdminUserSecurityPersistencePort,
} from '../../ports';
import { ListAdminSecurityEventsQuery } from './list-admin-security-events.query';
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
@Injectable()
export class ListAdminSecurityEventsQueryHandler {
  constructor(
    @Inject(ADMIN_USER_SECURITY_PERSISTENCE_PORT)
    private readonly persistence: AdminUserSecurityPersistencePort,
  ) {}
  async execute(
    query: ListAdminSecurityEventsQuery,
  ): Promise<readonly AdminSecurityEventView[]> {
    if (!(await this.persistence.userExists(query.userId)))
      throw new ResourceNotFoundException({
        code: 'ADMIN_USER_SECURITY_USER_NOT_FOUND',
        resource: 'người dùng',
        identifier: query.userId,
        message: 'Không tìm thấy người dùng cần quản lý bảo mật',
      });
    return this.persistence.listSecurityEvents({
      userId: query.userId,
      actions: SECURITY_ACTIONS,
    });
  }
}
