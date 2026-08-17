import {
  InvalidModerationReasonException,
  InvalidWarningMessageException,
} from '../exceptions';

export type CommentDatabaseModerationStatus =
  | 'visible' | 'pending' | 'hidden' | 'removed' | 'deleted';
export type CommentModerationStatusName = 'VISIBLE' | 'PENDING' | 'HIDDEN' | 'REMOVED';
export type CommentModerationActionName = 'HOLD_COMMENT' | 'HIDE_COMMENT' | 'RESTORE_COMMENT' | 'DELETE_COMMENT';
export type CommentModerationOperation = 'hold' | 'hide' | 'restore' | 'remove';

export interface CommentModerationPlan {
  readonly allowedCurrentStatuses: readonly CommentDatabaseModerationStatus[];
  readonly nextStatus: CommentModerationStatusName;
  readonly action: CommentModerationActionName;
  readonly auditAction: string;
}

export function normalizeModerationReason(value: string): string {
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (normalized.length < 10 || normalized.length > 2000) throw new InvalidModerationReasonException();
  return normalized;
}

export function normalizeWarningMessage(value: string): string {
  const normalized = value.normalize('NFKC').trim();
  if (normalized.length < 10 || normalized.length > 1000) throw new InvalidWarningMessageException();
  return normalized;
}

export function moderationPlanFor(operation: CommentModerationOperation): CommentModerationPlan {
  switch (operation) {
    case 'hold': return { allowedCurrentStatuses: ['visible'], nextStatus: 'PENDING', action: 'HOLD_COMMENT', auditAction: 'comment.moderation.held' };
    case 'hide': return { allowedCurrentStatuses: ['visible','pending'], nextStatus: 'HIDDEN', action: 'HIDE_COMMENT', auditAction: 'comment.moderation.hidden' };
    case 'restore': return { allowedCurrentStatuses: ['pending','hidden'], nextStatus: 'VISIBLE', action: 'RESTORE_COMMENT', auditAction: 'comment.moderation.restored' };
    case 'remove': return { allowedCurrentStatuses: ['visible','pending','hidden'], nextStatus: 'REMOVED', action: 'DELETE_COMMENT', auditAction: 'comment.moderation.removed' };
  }
}
