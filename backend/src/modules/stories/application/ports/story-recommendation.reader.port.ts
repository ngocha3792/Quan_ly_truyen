import type { StoryRecommendationFeedDto } from '../dto';

export const STORY_RECOMMENDATION_READER_PORT = Symbol(
  'STORY_RECOMMENDATION_READER_PORT',
);

export interface StoryRecommendationReaderPort {
  listForUser(
    userId: string | undefined,
    limit: number,
  ): Promise<StoryRecommendationFeedDto>;
}
