import { Inject, Injectable } from '@nestjs/common';
import { CommentNotFoundException } from '@/modules/comments';
import { ReportNotFoundException } from '@/modules/reports';
import {
  ModerationReportMismatchException,
  normalizeModerationReason,
  normalizeWarningMessage,
} from '../../../domain';
import {
  MODERATION_METRICS_PORT,
  MODERATION_PERSISTENCE_PORT,
  type ModerationMetricsPort,
  type ModerationPersistenceFailure,
  type ModerationPersistencePort,
} from '../../ports';
import { WarnUserCommand } from './warn-user.command';
@Injectable()
export class WarnUserCommandHandler {
  constructor(
    @Inject(MODERATION_PERSISTENCE_PORT)
    private readonly persistence: ModerationPersistencePort,
    @Inject(MODERATION_METRICS_PORT)
    private readonly metrics: ModerationMetricsPort,
  ) {}
  async execute(command: WarnUserCommand) {
    const result = await this.persistence.warnUser({
      ...command,
      reason: normalizeModerationReason(command.reason),
      message: normalizeWarningMessage(command.message),
    });
    throwFailure(result, command.commentId, command.reportId);
    if (result.status !== 'warned')
      throw new CommentNotFoundException(command.commentId);
    this.metrics.record('warn');
    return {
      success: true as const,
      commentId: result.commentId,
      warnedUserId: result.warnedUserId,
    };
  }
}
function throwFailure(
  result: ModerationPersistenceFailure | { readonly status: string },
  commentId: string,
  reportId?: string,
) {
  if (result.status === 'comment_not_found')
    throw new CommentNotFoundException(commentId);
  if (result.status === 'report_not_found')
    throw new ReportNotFoundException(reportId ?? 'unknown');
  if (result.status === 'report_mismatch')
    throw new ModerationReportMismatchException();
}
