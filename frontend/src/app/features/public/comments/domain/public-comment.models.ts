import type {
  CommentReactionApiType,
  CommentReportReasonApi,
} from '../../../../core/http/reader-engagement-api.model';

export interface PublicCommentAuthor {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
}

export interface PublicComment {
  readonly id: string;
  readonly parentId: string | null;
  readonly depth: 0 | 1 | 2;
  readonly displayState: 'VISIBLE' | 'DELETED';
  readonly author: PublicCommentAuthor;
  readonly content: string;
  readonly createdAt: string;
  readonly reactions: Readonly<Record<CommentReactionApiType, number>>;
  readonly viewerReaction: CommentReactionApiType | null;
  readonly replyCount: number;
  readonly threadReplyCount: number;
  readonly replies: readonly PublicComment[];
  readonly isOwner: boolean;
}

export interface PublicCommentReplyCreate {
  readonly rootId: string;
  readonly parentId: string;
  readonly body: string;
}

export interface PublicCommentReactionSet {
  readonly commentId: string;
  readonly type: CommentReactionApiType;
}

export interface PublicCommentReportCreate {
  readonly commentId: string;
  readonly reason: CommentReportReasonApi;
  readonly description?: string;
}
