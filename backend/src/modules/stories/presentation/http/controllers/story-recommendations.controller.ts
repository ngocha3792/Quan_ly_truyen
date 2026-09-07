import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CurrentUserId, Public } from '@/common/decorators';
import { OptionalJwtAuthGuard } from '@/common/guards';

import {
  ListStoryRecommendationsQuery,
  ListStoryRecommendationsQueryHandler,
} from '../../../application';
import { ListStoryRecommendationsRequest } from '../requests';
import {
  type StoryRecommendationFeedResponse,
  toStoryRecommendationFeedResponse,
} from '../responses';

@Controller('recommendations')
export class StoryRecommendationsController {
  constructor(
    private readonly recommendations: ListStoryRecommendationsQueryHandler,
  ) {}

  @Get('stories')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  async list(
    @CurrentUserId() userId: string | undefined,
    @Query() request: ListStoryRecommendationsRequest,
  ): Promise<StoryRecommendationFeedResponse> {
    const feed = await this.recommendations.execute(
      new ListStoryRecommendationsQuery(userId, request.limit),
    );
    return toStoryRecommendationFeedResponse(feed);
  }
}
