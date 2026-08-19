import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '@/common/exceptions';
import type { AdminSessionView } from '../../dto';
import {
  ADMIN_USER_SECURITY_PERSISTENCE_PORT,
  type AdminUserSecurityPersistencePort,
} from '../../ports';
import { ListAdminUserSessionsQuery } from './list-admin-user-sessions.query';
@Injectable()
export class ListAdminUserSessionsQueryHandler {
  constructor(
    @Inject(ADMIN_USER_SECURITY_PERSISTENCE_PORT)
    private readonly persistence: AdminUserSecurityPersistencePort,
  ) {}
  async execute(
    query: ListAdminUserSessionsQuery,
  ): Promise<readonly AdminSessionView[]> {
    if (!(await this.persistence.userExists(query.userId)))
      throw userNotFound(query.userId);
    return this.persistence.listSessions(query.userId);
  }
}
function userNotFound(id: string) {
  return new ResourceNotFoundException({
    code: 'ADMIN_USER_SECURITY_USER_NOT_FOUND',
    resource: 'người dùng',
    identifier: id,
    message: 'Không tìm thấy người dùng cần quản lý bảo mật',
  });
}
