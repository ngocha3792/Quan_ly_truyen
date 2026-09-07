import type { PublicStoryDto } from './public-story-result.dto';

export type StoryRecommendationReason =
  'FOLLOWED_AUTHOR' | 'PREFERRED_CATEGORY' | 'HIGH_RATING' | 'POPULAR';

export interface StoryRecommendationItemDto {
  readonly story: PublicStoryDto;
  readonly reasonCode: StoryRecommendationReason;
  readonly reason: string;
  readonly matchedCategories: readonly string[];
}

export interface StoryRecommendationFeedDto {
  readonly personalized: boolean;
  readonly items: readonly StoryRecommendationItemDto[];
}
