import type { ReadingBookmarkResultDto } from '../dto';

export const READING_BOOKMARK_PERSISTENCE_PORT = Symbol(
  'READING_BOOKMARK_PERSISTENCE_PORT',
);

export interface UpsertReadingBookmarkInput {
  readonly userId: string;
  readonly chapterId: string;
  readonly position: number;
}

export type UpsertReadingBookmarkResult =
  | { readonly status: 'saved'; readonly bookmark: ReadingBookmarkResultDto }
  | { readonly status: 'chapter_not_found' };

export interface ReadingBookmarkPersistencePort {
  listMine(userId: string): Promise<readonly ReadingBookmarkResultDto[]>;

  getMineByChapter(
    userId: string,
    chapterId: string,
  ): Promise<ReadingBookmarkResultDto | null>;

  upsertMine(
    input: UpsertReadingBookmarkInput,
  ): Promise<UpsertReadingBookmarkResult>;

  removeMine(userId: string, chapterId: string): Promise<void>;
}
