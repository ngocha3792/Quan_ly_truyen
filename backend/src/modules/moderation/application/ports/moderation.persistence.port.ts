import type {
  CommentDatabaseModerationStatus,
  CommentModerationActionName,
  CommentModerationOperation,
  CommentModerationStatusName,
} from '../../domain';

export interface ModerationAuditContext {
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
}

export type ModerationPersistenceFailure =
  | { readonly status: 'comment_not_found' }
  | { readonly status: 'report_not_found' }
  | { readonly status: 'report_mismatch' };

export type ModerateCommentPersistenceResult =
  | {
      readonly status: 'updated';
      readonly commentId: string;
      readonly moderationStatus: CommentModerationStatusName;
    }
  | {
      readonly status: 'invalid_transition';
      readonly currentStatus: string;
    }
  | ModerationPersistenceFailure;

export type WarnUserPersistenceResult =
  | {
      readonly status: 'warned';
      readonly commentId: string;
      readonly warnedUserId: string;
    }
  | ModerationPersistenceFailure;

export type BanTargetPersistenceResult =
  | {
      readonly status: 'found';
      readonly commentId: string;
      readonly userId: string;
    }
  | ModerationPersistenceFailure;

export interface ModerationPersistencePort {
  moderateComment(input: {
    readonly actorId: string;
    readonly commentId: string;
    readonly operation: CommentModerationOperation;
    readonly reason: string;
    readonly reportId?: string;
    readonly audit: ModerationAuditContext;
    readonly allowedCurrentStatuses: readonly CommentDatabaseModerationStatus[];
    readonly nextStatus: CommentModerationStatusName;
    readonly action: CommentModerationActionName;
    readonly auditAction: string;
  }): Promise<ModerateCommentPersistenceResult>;

  warnUser(input: {
    readonly actorId: string;
    readonly commentId: string;
    readonly message: string;
    readonly reason: string;
    readonly reportId?: string;
    readonly audit: ModerationAuditContext;
  }): Promise<WarnUserPersistenceResult>;

  findBanTarget(input: {
    readonly commentId: string;
    readonly reportId?: string;
  }): Promise<BanTargetPersistenceResult>;

  recordUserBan(input: {
    readonly actorId: string;
    readonly commentId: string;
    readonly userId: string;
    readonly reason: string;
    readonly reportId?: string;
    readonly audit: ModerationAuditContext;
  }): Promise<void>;
}

export const MODERATION_PERSISTENCE_PORT = Symbol('MODERATION_PERSISTENCE_PORT');
