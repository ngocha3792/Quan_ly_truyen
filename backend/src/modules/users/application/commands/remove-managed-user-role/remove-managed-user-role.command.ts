import type { RoleCode } from '@/common/enums';

export class RemoveManagedUserRoleCommand {
  constructor(
    readonly actorUserId: string | undefined,

    readonly targetUserId: string,

    readonly roleCode: RoleCode,

    readonly ipAddress?: string,

    readonly userAgent?: string,

    readonly requestId?: string,
  ) {}
}
