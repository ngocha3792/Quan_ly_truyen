import type { ManagedUserStatus } from '../../../domain';

export class UpdateManagedUserStatusCommand {
  constructor(
    readonly actorUserId: string | undefined,

    readonly targetUserId: string,

    readonly status: ManagedUserStatus,

    readonly ipAddress?: string,

    readonly userAgent?: string,

    readonly requestId?: string,
  ) {}
}
