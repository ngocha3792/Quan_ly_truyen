export interface CommentWriteGuardPort {
  validateBody(body: string): string;
  prepare(input: {
    userId: string;
    storyId: string;
    chapterId?: string | null;
    anchorBlockId?: string;
    body: string;
    ipAddress?: string;
  }): Promise<string>;
}
export const COMMENT_WRITE_GUARD_PORT = Symbol('COMMENT_WRITE_GUARD_PORT');
