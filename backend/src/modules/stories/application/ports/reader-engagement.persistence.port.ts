import type {
  LibraryEntryResultDto,
  ReadingHistoryEntryResultDto,
  StoryCommentPageResultDto,
  StoryCommentResultDto,
  StoryRatingResultDto,
} from '../dto/reader-engagement-result.dto';

export const READER_ENGAGEMENT_PERSISTENCE_PORT = Symbol(
  'READER_ENGAGEMENT_PERSISTENCE_PORT',
);

export type LibraryEntryStatus =
  'PLAN_TO_READ' | 'READING' | 'COMPLETED' | 'ON_HOLD' | 'DROPPED';

export interface UpsertLibraryEntryInput {
  readonly userId: string;
  readonly storyId: string;
  readonly status?: LibraryEntryStatus;
  readonly isFavorite?: boolean;
  readonly updatedAt: Date;
}

export type UpsertLibraryEntryResult =
  | { readonly status: 'updated'; readonly entry: LibraryEntryResultDto }
  | { readonly status: 'story_not_found' };

export interface SaveReadingProgressInput {
  readonly userId: string;
  readonly storyId: string;
  readonly chapterId: string;
  readonly position: number;
  readonly readAt: Date;
}

export type SaveReadingProgressResult =
  | { readonly status: 'saved'; readonly entry: ReadingHistoryEntryResultDto }
  | { readonly status: 'story_not_found' }
  | { readonly status: 'chapter_not_found' };

export interface UpsertStoryRatingInput {
  readonly userId: string;
  readonly storyId: string;
  readonly score: number;
  readonly updatedAt: Date;
}

export type UpsertStoryRatingResult =
  | { readonly status: 'updated'; readonly rating: StoryRatingResultDto }
  | { readonly status: 'story_not_found' };

export interface CreateStoryCommentInput {
  readonly userId: string;
  readonly storyId: string;
  readonly chapterId?: string;
  readonly body: string;
  readonly createdAt: Date;
}

export type CreateStoryCommentResult =
  | { readonly status: 'created'; readonly comment: StoryCommentResultDto }
  | { readonly status: 'story_not_found' }
  | { readonly status: 'chapter_not_found' };

export interface UpdateStoryCommentInput {
  readonly userId: string;
  readonly commentId: string;
  readonly body: string;
  readonly updatedAt: Date;
}

export type UpdateStoryCommentResult =
  | { readonly status: 'updated'; readonly comment: StoryCommentResultDto }
  | { readonly status: 'not_found' };

export interface DeleteStoryCommentInput {
  readonly userId: string;
  readonly commentId: string;
  readonly deletedAt: Date;
}

export type DeleteStoryCommentResult =
  { readonly status: 'deleted' } | { readonly status: 'not_found' };

export interface ListCommentsInput {
  readonly storySlug: string;
  readonly chapterNumber?: string;
  readonly page: number;
  readonly pageSize: number;
}

export type ListCommentsResult =
  | { readonly status: 'found'; readonly page: StoryCommentPageResultDto }
  | { readonly status: 'story_not_found' }
  | { readonly status: 'chapter_not_found' };

export interface ReaderEngagementPersistencePort {
  listLibrary(userId: string): Promise<readonly LibraryEntryResultDto[]>;
  upsertLibraryEntry(
    input: UpsertLibraryEntryInput,
  ): Promise<UpsertLibraryEntryResult>;
  removeLibraryEntry(userId: string, storyId: string): Promise<void>;

  listReadingHistory(
    userId: string,
  ): Promise<readonly ReadingHistoryEntryResultDto[]>;
  saveReadingProgress(
    input: SaveReadingProgressInput,
  ): Promise<SaveReadingProgressResult>;
  removeReadingHistoryEntry(userId: string, storyId: string): Promise<void>;
  clearReadingHistory(userId: string): Promise<void>;

  findMyRating(
    userId: string,
    storyId: string,
  ): Promise<StoryRatingResultDto | null>;
  upsertRating(input: UpsertStoryRatingInput): Promise<UpsertStoryRatingResult>;
  deleteRating(userId: string, storyId: string): Promise<void>;

  listComments(input: ListCommentsInput): Promise<ListCommentsResult>;
  createComment(
    input: CreateStoryCommentInput,
  ): Promise<CreateStoryCommentResult>;
  updateComment(
    input: UpdateStoryCommentInput,
  ): Promise<UpdateStoryCommentResult>;
  deleteComment(
    input: DeleteStoryCommentInput,
  ): Promise<DeleteStoryCommentResult>;
}
