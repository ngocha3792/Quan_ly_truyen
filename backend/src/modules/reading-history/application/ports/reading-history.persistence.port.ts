import type {
  ReadingHistoryEntryResultDto,
  WeeklyReadingStatsResultDto,
} from '../dto';
import type { ReadingCursor, ReadingProgressSyncMetadata } from '../../domain';

export const READING_HISTORY_PERSISTENCE_PORT = Symbol(
  'READING_HISTORY_PERSISTENCE_PORT',
);

export interface SaveReadingProgressInput {
  readonly userId: string;
  readonly storyId: string;
  readonly chapterId: string;
  readonly position: number;
  readonly cursor?: ReadingCursor;
  readonly sync?: ReadingProgressSyncMetadata;
  readonly readAt: Date;
}

export type SaveReadingProgressResult =
  | { readonly status: 'saved'; readonly entry: ReadingHistoryEntryResultDto }
  | {
      readonly status: 'duplicate';
      readonly entry: ReadingHistoryEntryResultDto;
    }
  | {
      readonly status: 'revision_conflict';
      readonly expectedRevision: number;
      readonly actualRevision: number;
      readonly entry: ReadingHistoryEntryResultDto | null;
    }
  | { readonly status: 'story_not_found' }
  | { readonly status: 'chapter_not_found' };

export interface ReadingHistoryPersistencePort {
  listMine(userId: string): Promise<readonly ReadingHistoryEntryResultDto[]>;

  getWeeklyStats(userId: string): Promise<WeeklyReadingStatsResultDto>;

  getProgress(
    userId: string,
    storyId: string,
  ): Promise<ReadingHistoryEntryResultDto | null>;

  saveProgress(
    input: SaveReadingProgressInput,
  ): Promise<SaveReadingProgressResult>;

  removeMine(userId: string, storyId: string): Promise<void>;

  clearMine(userId: string): Promise<void>;
}
