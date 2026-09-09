export type CommentAbuseScope = 'comment-write' | 'reaction' | 'report';
export interface CommentAbuseGuardPort {
  readonly duplicateWindowSeconds: number;
  readonly maxLinks: number;
  consume(
    scope: CommentAbuseScope,
    userId: string,
    ipAddress?: string,
    context?: {
      readonly chapterId?: string | null;
      readonly anchorBlockId?: string;
    },
  ): Promise<void>;
}
export const COMMENT_ABUSE_GUARD_PORT = Symbol('COMMENT_ABUSE_GUARD_PORT');
