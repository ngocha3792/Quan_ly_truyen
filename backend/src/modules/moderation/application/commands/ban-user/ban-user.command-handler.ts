import { Inject, Injectable } from '@nestjs/common';
import { USER_MODERATION_PORT, type UserModerationPort } from '@/modules/users';
import { CommentNotFoundException } from '@/modules/comments';
import { ReportNotFoundException } from '@/modules/reports';
import {
  ModerationReportMismatchException,
  normalizeModerationReason,
} from '../../../domain';
import {
  MODERATION_METRICS_PORT,
  MODERATION_PERSISTENCE_PORT,
  type ModerationMetricsPort,
  type ModerationPersistenceFailure,
  type ModerationPersistencePort,
} from '../../ports';
import { BanUserCommand } from './ban-user.command';
@Injectable()
export class BanUserCommandHandler {
  constructor(
    @Inject(MODERATION_PERSISTENCE_PORT)
    private readonly persistence: ModerationPersistencePort,
    @Inject(USER_MODERATION_PORT) private readonly users: UserModerationPort,
    @Inject(MODERATION_METRICS_PORT)
    private readonly metrics: ModerationMetricsPort,
  ) {}
  async execute(command: BanUserCommand) {
    const reason = normalizeModerationReason(command.reason);
    const target = await this.persistence.findBanTarget({
      commentId: command.commentId,
      reportId: command.reportId,
    });
    throwFailure(target, command.commentId, command.reportId);
    if (target.status !== 'found')
      throw new CommentNotFoundException(command.commentId);
    await this.users.banUser({
      actorUserId: command.actorId,
      targetUserId: target.userId,
      reason,
      ipAddress: command.audit.ipAddress,
      userAgent: command.audit.userAgent,
      requestId: command.audit.requestId,
    });
    await this.persistence.recordUserBan({
      actorId: command.actorId,
      commentId: target.commentId,
      userId: target.userId,
      reason,
      reportId: command.reportId,
      audit: command.audit,
    });
    this.metrics.record('ban');
    return { success: true as const, userId: target.userId };
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
