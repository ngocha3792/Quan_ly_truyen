import type { ModerationAuditContext } from '../../ports';
export class BanUserCommand {
  constructor(
    readonly actorId: string,
    readonly commentId: string,
    readonly reason: string,
    readonly reportId: string | undefined,
    readonly audit: ModerationAuditContext,
  ) {}
}
