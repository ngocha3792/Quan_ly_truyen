export interface RecentCommentReaderPort {
  findRecentBodies(input: {
    readonly userId: string;
    readonly storyId: string;
    readonly chapterId: string | null;
    readonly from: Date;
    readonly limit: number;
  }): Promise<readonly string[]>;
}

export const RECENT_COMMENT_READER_PORT = Symbol('RECENT_COMMENT_READER_PORT');
