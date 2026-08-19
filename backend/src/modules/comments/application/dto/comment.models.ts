import type { ReactionName } from '../../domain';

export type { ReactionName, ReportReasonName } from '../../domain';

export type CommentDisplayState = 'VISIBLE' | 'DELETED';

export interface CommentView {
  readonly id: string;
  readonly storyId: string;
  readonly chapterId: string | null;
  readonly parentId: string | null;
  readonly depth: 0 | 1 | 2;
  readonly body: string;
  readonly displayState: CommentDisplayState;
  readonly user: {
    readonly id: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
  };
  readonly likeCount: number;
  readonly reactions: Readonly<Record<ReactionName, number>>;
  readonly replyCount: number;
  readonly threadReplyCount: number;
  readonly editedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CommentPageView {
  readonly items: readonly CommentView[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

export interface ReactionSummaryView {
  readonly commentId: string;
  readonly viewerReaction: ReactionName | null;
  readonly reactions: Readonly<Record<ReactionName, number>>;
  readonly total: number;
}

export interface CommentReportView {
  readonly id: string;
  readonly status: string;
  readonly reason: string;
  readonly createdAt: string;
}
