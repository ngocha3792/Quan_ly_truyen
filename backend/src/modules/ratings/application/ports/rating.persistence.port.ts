import type { StoryRatingResultDto } from '../dto';

export const RATING_PERSISTENCE_PORT = Symbol('RATING_PERSISTENCE_PORT');

export interface UpsertRatingInput {
  readonly userId: string;
  readonly storyId: string;
  readonly score: number;
  readonly updatedAt: Date;
}

export type UpsertRatingResult =
  | { readonly status: 'updated'; readonly rating: StoryRatingResultDto }
  | { readonly status: 'story_not_found' };

export interface RatingPersistencePort {
  findMine(
    userId: string,
    storyId: string,
  ): Promise<StoryRatingResultDto | null>;

  upsert(input: UpsertRatingInput): Promise<UpsertRatingResult>;

  deleteMine(userId: string, storyId: string): Promise<void>;
}
