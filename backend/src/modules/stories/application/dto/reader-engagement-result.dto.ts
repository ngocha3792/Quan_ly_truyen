export interface ReaderStorySummaryDto {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly author: string;
  readonly coverUrl: string | null;
  readonly categories: readonly string[];
  readonly latestChapterNumber: number | null;
  readonly chapterCount: number;
}

export interface LibraryEntryResultDto {
  readonly story: ReaderStorySummaryDto;
  readonly status: string;
  readonly isFavorite: boolean;
  readonly lastReadChapter: {
    readonly id: string;
    readonly number: number;
    readonly title: string;
  } | null;
  readonly progressPercent: number;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly updatedAt: string;
}

export interface ReadingHistoryEntryResultDto {
  readonly story: ReaderStorySummaryDto;
  readonly currentChapter: {
    readonly id: string;
    readonly number: number;
    readonly title: string;
  } | null;
  readonly position: number;
  readonly progressPercent: number;
  readonly lastReadAt: string;
}

export interface StoryRatingResultDto {
  readonly storyId: string;
  readonly score: number;
  readonly updatedAt: string;
}

export interface StoryCommentUserDto {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

export interface StoryCommentResultDto {
  readonly id: string;
  readonly storyId: string;
  readonly chapterId: string | null;
  readonly parentId: string | null;
  readonly depth: 0 | 1 | 2;
  readonly body: string;
  readonly displayState: 'VISIBLE' | 'DELETED';
  readonly user: StoryCommentUserDto;
  readonly likeCount: number;
  readonly reactions: {
    readonly LIKE: number;
    readonly LOVE: number;
    readonly LAUGH: number;
    readonly INSIGHTFUL: number;
  };
  readonly replyCount: number;
  readonly threadReplyCount: number;
  readonly editedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StoryCommentPageResultDto {
  readonly items: readonly StoryCommentResultDto[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}
