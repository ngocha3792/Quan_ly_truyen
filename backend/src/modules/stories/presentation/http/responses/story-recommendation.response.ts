import type { StoryRecommendationFeedDto } from '../../../application';
import {
  type PublicStoryResponse,
  toPublicStoryResponse,
} from './public-story.response';

export interface StoryRecommendationFeedResponse {
  readonly personalized: boolean;
  readonly items: readonly {
    readonly story: PublicStoryResponse;
    readonly reasonCode: StoryRecommendationFeedDto['items'][number]['reasonCode'];
    readonly reason: string;
    readonly matchedCategories: readonly string[];
  }[];
}

export function toStoryRecommendationFeedResponse(
  feed: StoryRecommendationFeedDto,
): StoryRecommendationFeedResponse {
  return {
    personalized: feed.personalized,
    items: feed.items.map((item) => ({
      story: toPublicStoryResponse(item.story),
      reasonCode: item.reasonCode,
      reason: item.reason,
      matchedCategories: [...item.matchedCategories],
    })),
  };
}
