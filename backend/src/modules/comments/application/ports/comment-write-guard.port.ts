export interface CommentWriteGuardPort {
  prepare(input: { userId: string; storyId: string; chapterId?: string | null; body: string; ipAddress?: string; }): Promise<string>;
}
export const COMMENT_WRITE_GUARD_PORT = Symbol('COMMENT_WRITE_GUARD_PORT');
