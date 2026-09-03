export type LibraryApiStatus = 'PLAN_TO_READ' | 'READING' | 'COMPLETED' | 'ON_HOLD' | 'DROPPED';

export interface ReaderStoryApiSummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly author: string;
  readonly coverUrl: string | null;
  readonly categories: readonly string[];
  readonly latestChapterNumber: number | null;
  readonly chapterCount: number;
}

export interface LibraryEntryApiItem {
  readonly story: ReaderStoryApiSummary;
  readonly status: LibraryApiStatus;
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

export interface ReadingHistoryApiItem {
  readonly story: ReaderStoryApiSummary;
  readonly currentChapter: {
    readonly id: string;
    readonly number: number;
    readonly title: string;
  } | null;
  readonly position: number;
  readonly progressPercent: number;
  readonly lastReadAt: string;
}

export interface ReadingBookmarkApiItem {
  readonly id: string;
  readonly storyId: string;
  readonly chapterId: string;
  readonly position: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StoryRatingApiItem {
  readonly storyId: string;
  readonly score: number;
  readonly updatedAt: string;
}

export interface ReadingGoalApiItem {
  readonly targetChapters: number;
  readonly completedChapters: number;
  readonly remainingDays: number;
}

export type CommentReactionApiType = 'LIKE' | 'LOVE' | 'LAUGH' | 'INSIGHTFUL';
export type CommentReportReasonApi =
  | 'SPAM'
  | 'HARASSMENT'
  | 'HATE_SPEECH'
  | 'SEXUAL_CONTENT'
  | 'VIOLENCE'
  | 'COPYRIGHT'
  | 'MISINFORMATION'
  | 'OTHER';

export interface CommentReactionSummaryApi {
  readonly commentId: string;
  readonly viewerReaction: CommentReactionApiType | null;
  readonly reactions: Readonly<Record<CommentReactionApiType, number>>;
  readonly total: number;
}

export interface StoryCommentApiItem {
  readonly id: string;
  readonly storyId: string;
  readonly chapterId: string | null;
  readonly parentId: string | null;
  readonly depth: 0 | 1 | 2;
  readonly body: string;
  readonly displayState: 'VISIBLE' | 'DELETED';
  readonly user: {
    readonly id: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
  };
  readonly likeCount: number;
  readonly reactions: Readonly<Record<CommentReactionApiType, number>>;
  readonly replyCount: number;
  readonly threadReplyCount: number;
  readonly editedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StoryCommentApiPage {
  readonly items: readonly StoryCommentApiItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}
