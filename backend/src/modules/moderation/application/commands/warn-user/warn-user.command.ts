import type { ModerationAuditContext } from '../../ports';
export class WarnUserCommand {
  constructor(
    readonly actorId: string,
    readonly commentId: string,
    readonly message: string,
    readonly reason: string,
    readonly reportId: string | undefined,
    readonly audit: ModerationAuditContext,
  ) {}
}
