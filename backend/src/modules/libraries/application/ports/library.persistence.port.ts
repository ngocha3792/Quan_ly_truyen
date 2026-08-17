import type { LibraryEntryResultDto } from '../dto';

export const LIBRARY_PERSISTENCE_PORT = Symbol('LIBRARY_PERSISTENCE_PORT');

export type LibraryEntryStatus =
  | 'PLAN_TO_READ'
  | 'READING'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'DROPPED';

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

export interface LibraryPersistencePort {
  listMine(userId: string): Promise<readonly LibraryEntryResultDto[]>;

  upsert(input: UpsertLibraryEntryInput): Promise<UpsertLibraryEntryResult>;

  removeMine(userId: string, storyId: string): Promise<void>;
}
