import { Inject, Injectable } from '@nestjs/common';

import type { StoryRecommendationFeedDto } from '../../dto';
import {
  STORY_RECOMMENDATION_READER_PORT,
  type StoryRecommendationReaderPort,
} from '../../ports';
import { ListStoryRecommendationsQuery } from './list-story-recommendations.query';

@Injectable()
export class ListStoryRecommendationsQueryHandler {
  constructor(
    @Inject(STORY_RECOMMENDATION_READER_PORT)
    private readonly reader: StoryRecommendationReaderPort,
  ) {}

  execute(
    query: ListStoryRecommendationsQuery,
  ): Promise<StoryRecommendationFeedDto> {
    return this.reader.listForUser(query.userId, query.limit);
  }
}
