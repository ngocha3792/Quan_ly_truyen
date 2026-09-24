import {
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId, Public } from '@/common/decorators';
import { OptionalJwtAuthGuard } from '@/common/guards';
import {
  RECOMMENDATION_EXPERIMENT_PORT,
  RECOMMENDATION_PORT,
  type RecommendationExperimentPort,
  type RecommendationPort,
} from '../../../application';

class ImpressionRequest {
  context!: string;
  storyId?: string;
  recommendedStoryIds!: string[];
  algorithm!: 'heuristic' | 'collaborative' | 'hybrid';
  experimentId?: string;
  variant?: 'control' | 'treatment';
}

@Controller('recommendations')
export class RecommendationController {
  constructor(
    @Inject(RECOMMENDATION_PORT)
    private readonly recommendations: RecommendationPort,
    @Inject(RECOMMENDATION_EXPERIMENT_PORT)
    private readonly experiments: RecommendationExperimentPort,
  ) {}

  @Get('preferences')
  async preferences(@CurrentUserId() userId: string | undefined) {
    if (!userId) return { personalizationEnabled: true };
    return this.recommendations.getPreferences(userId);
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUserId() userId: string | undefined,
    @Body() body: { personalizationEnabled?: boolean },
  ) {
    if (!userId || typeof body.personalizationEnabled !== 'boolean')
      return { personalizationEnabled: true };
    return this.recommendations.updatePreferences(
      userId,
      body.personalizationEnabled,
    );
  }
  @Get('collaborative')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  async collaborative(
    @CurrentUserId() userId: string | undefined,
    @Query('limit') limit?: string,
  ) {
    if (!userId)
      return {
        algorithm: 'heuristic',
        fallbackReason: 'ANONYMOUS_USER',
        items: [],
      };
    const items = await this.recommendations.getCollaborativeRecommendations(
      userId,
      Math.min(Number(limit) || 20, 50),
    );
    return {
      algorithm: items.length ? 'collaborative' : 'heuristic',
      fallbackReason: items.length ? null : 'NO_INTERACTION_HISTORY',
      items,
    };
  }
  @Post('impressions')
  @UseGuards(OptionalJwtAuthGuard)
  async impression(
    @CurrentUserId() userId: string | undefined,
    @Body() request: ImpressionRequest,
  ): Promise<{ accepted: true }> {
    await this.experiments.trackImpression({ ...request, userId });
    return { accepted: true };
  }
}
