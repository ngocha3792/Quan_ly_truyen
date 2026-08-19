import type { CommentModerationOperation } from '../../../domain';
import type { ModerationAuditContext } from '../../ports';
export class ModerateCommentCommand {
  constructor(
    readonly actorId: string,
    readonly commentId: string,
    readonly operation: CommentModerationOperation,
    readonly reason: string,
    readonly reportId: string | undefined,
    readonly audit: ModerationAuditContext,
  ) {}
}
