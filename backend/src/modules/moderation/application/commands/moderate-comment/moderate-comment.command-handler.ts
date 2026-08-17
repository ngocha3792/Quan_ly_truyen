import { Inject, Injectable } from '@nestjs/common';
import { CommentNotFoundException } from '@/modules/comments';
import { ReportNotFoundException } from '@/modules/reports';
import { InvalidCommentModerationTransitionException, ModerationReportMismatchException, moderationPlanFor, normalizeModerationReason } from '../../../domain';
import { MODERATION_METRICS_PORT, MODERATION_PERSISTENCE_PORT, type ModerationMetricsPort, type ModerationPersistenceFailure, type ModerationPersistencePort } from '../../ports';
import { ModerateCommentCommand } from './moderate-comment.command';
@Injectable()
export class ModerateCommentCommandHandler {
  constructor(@Inject(MODERATION_PERSISTENCE_PORT) private readonly persistence: ModerationPersistencePort, @Inject(MODERATION_METRICS_PORT) private readonly metrics: ModerationMetricsPort) {
  }
  async execute(command: ModerateCommentCommand) {
    const reason = normalizeModerationReason(command.reason);
    const plan = moderationPlanFor(command.operation);
    const result = await this.persistence.moderateComment({ ...command, reason, ...plan });
    if (result.status === 'invalid_transition') throw new InvalidCommentModerationTransitionException(result.currentStatus.toUpperCase(), command.operation.toUpperCase());
    throwPersistenceFailure(result, command.commentId, command.reportId);
    if (result.status !== 'updated') throw new CommentNotFoundException(command.commentId);
    this.metrics.record(command.operation);
    return { commentId: result.commentId, moderationStatus: result.moderationStatus };
  }
}
function throwPersistenceFailure(result: ModerationPersistenceFailure | { readonly status: string }, commentId: string, reportId?: string) {
  if (result.status === 'comment_not_found') throw new CommentNotFoundException(commentId);
  if (result.status === 'report_not_found') throw new ReportNotFoundException(reportId ?? 'unknown');
  if (result.status === 'report_mismatch') throw new ModerationReportMismatchException();
}
