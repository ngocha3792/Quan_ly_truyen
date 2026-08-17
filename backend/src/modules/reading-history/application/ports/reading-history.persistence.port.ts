import type { ReadingHistoryEntryResultDto } from '../dto';

export const READING_HISTORY_PERSISTENCE_PORT = Symbol(
  'READING_HISTORY_PERSISTENCE_PORT',
);

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

export interface ReadingHistoryPersistencePort {
  listMine(userId: string): Promise<readonly ReadingHistoryEntryResultDto[]>;

  saveProgress(input: SaveReadingProgressInput): Promise<SaveReadingProgressResult>;

  removeMine(userId: string, storyId: string): Promise<void>;

  clearMine(userId: string): Promise<void>;
}
