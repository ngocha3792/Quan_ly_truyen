import { Inject, Injectable } from '@nestjs/common';
import { USER_MODERATION_PORT, type UserModerationPort } from '@/modules/users';
import { ReportNotFoundException } from '@/modules/reports';
import { CommentNotFoundException } from '@/modules/comments';
import {
  InvalidCommentModerationTransitionException,
  InvalidModerationReasonException,
  InvalidWarningMessageException,
  ModerationReportMismatchException,
} from '../domain';
import type { CommentModerationOperation } from './moderation.models';
import {
  MODERATION_METRICS_PORT,
  MODERATION_PERSISTENCE_PORT,
  type CommentDatabaseModerationStatus,
  type CommentModerationActionName,
  type CommentModerationStatusName,
  type ModerationAuditContext,
  type ModerationMetricsPort,
  type ModerationPersistenceFailure,
  type ModerationPersistencePort,
} from './ports';

interface ModerationPlan {
  readonly allowedCurrentStatuses: readonly CommentDatabaseModerationStatus[];
  readonly nextStatus: CommentModerationStatusName;
  readonly action: CommentModerationActionName;
  readonly auditAction: string;
}

@Injectable()
export class ModerationService {
  constructor(
    @Inject(MODERATION_PERSISTENCE_PORT)
    private readonly persistence: ModerationPersistencePort,
    @Inject(USER_MODERATION_PORT)
    private readonly users: UserModerationPort,
    @Inject(MODERATION_METRICS_PORT)
    private readonly metrics: ModerationMetricsPort,
  ) {}

  async moderateComment(input: {
    actorId: string;
    commentId: string;
    operation: CommentModerationOperation;
    reason: string;
    reportId?: string;
    audit: ModerationAuditContext;
  }) {
    const reason = this.reason(input.reason);
    const plan = this.planFor(input.operation);
    const result = await this.persistence.moderateComment({
      ...input,
      reason,
      ...plan,
    });

    if (result.status === 'invalid_transition') {
      throw new InvalidCommentModerationTransitionException(
        result.currentStatus.toUpperCase(),
        input.operation.toUpperCase(),
      );
    }
    this.throwPersistenceFailure(result, input.commentId, input.reportId);
    if (result.status !== 'updated') {
      throw new CommentNotFoundException(input.commentId);
    }

    this.metrics.record(input.operation);
    return {
      commentId: result.commentId,
      moderationStatus: result.moderationStatus,
    };
  }

  async warnUser(input: {
    actorId: string;
    commentId: string;
    message: string;
    reason: string;
    reportId?: string;
    audit: ModerationAuditContext;
  }) {
    const reason = this.reason(input.reason);
    const message = input.message.normalize('NFKC').trim();
    if (message.length < 10 || message.length > 1000) {
      throw new InvalidWarningMessageException();
    }

    const result = await this.persistence.warnUser({
      ...input,
      reason,
      message,
    });
    this.throwPersistenceFailure(result, input.commentId, input.reportId);
    if (result.status !== 'warned') {
      throw new CommentNotFoundException(input.commentId);
    }

    this.metrics.record('warn');
    return {
      success: true as const,
      commentId: result.commentId,
      warnedUserId: result.warnedUserId,
    };
  }

  async banUser(input: {
    actorId: string;
    commentId: string;
    reason: string;
    reportId?: string;
    audit: ModerationAuditContext;
  }) {
    const reason = this.reason(input.reason);
    const target = await this.persistence.findBanTarget({
      commentId: input.commentId,
      reportId: input.reportId,
    });
    this.throwPersistenceFailure(target, input.commentId, input.reportId);
    if (target.status !== 'found') {
      throw new CommentNotFoundException(input.commentId);
    }

    await this.users.banUser({
      actorUserId: input.actorId,
      targetUserId: target.userId,
      reason,
      ipAddress: input.audit.ipAddress,
      userAgent: input.audit.userAgent,
      requestId: input.audit.requestId,
    });

    await this.persistence.recordUserBan({
      actorId: input.actorId,
      commentId: target.commentId,
      userId: target.userId,
      reason,
      reportId: input.reportId,
      audit: input.audit,
    });

    this.metrics.record('ban');
    return { success: true as const, userId: target.userId };
  }

  private planFor(operation: CommentModerationOperation): ModerationPlan {
    switch (operation) {
      case 'hold':
        return {
          allowedCurrentStatuses: ['visible'],
          nextStatus: 'PENDING',
          action: 'HOLD_COMMENT',
          auditAction: 'comment.moderation.held',
        };
      case 'hide':
        return {
          allowedCurrentStatuses: ['visible', 'pending'],
          nextStatus: 'HIDDEN',
          action: 'HIDE_COMMENT',
          auditAction: 'comment.moderation.hidden',
        };
      case 'restore':
        return {
          allowedCurrentStatuses: ['pending', 'hidden'],
          nextStatus: 'VISIBLE',
          action: 'RESTORE_COMMENT',
          auditAction: 'comment.moderation.restored',
        };
      case 'remove':
        return {
          allowedCurrentStatuses: ['visible', 'pending', 'hidden'],
          nextStatus: 'REMOVED',
          action: 'DELETE_COMMENT',
          auditAction: 'comment.moderation.removed',
        };
    }
  }

  private throwPersistenceFailure(
    result: ModerationPersistenceFailure | { readonly status: string },
    commentId: string,
    reportId?: string,
  ): void {
    if (result.status === 'comment_not_found') {
      throw new CommentNotFoundException(commentId);
    }
    if (result.status === 'report_not_found') {
      throw new ReportNotFoundException(reportId ?? 'unknown');
    }
    if (result.status === 'report_mismatch') {
      throw new ModerationReportMismatchException();
    }
  }

  private reason(value: string): string {
    const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (normalized.length < 10 || normalized.length > 2000) {
      throw new InvalidModerationReasonException();
    }
    return normalized;
  }
}
