import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import { AuthorAnalyticsService } from '../../application/author-analytics.service';
import { AnalyticsDateRangeRequest, AnalyticsStoriesRequest } from './requests/analytics-date-range.request';

@Controller('author/analytics')
@RequirePermissions(PermissionCode.ANALYTICS_READ)
export class AuthorAnalyticsController {
  constructor(private readonly analytics: AuthorAnalyticsService) {}

  @Get('overview')
  overview(
    @CurrentUserId() userId: string | undefined,
    @Query() query: AnalyticsDateRangeRequest,
  ) {
    return this.analytics.overview(userId, query.from, query.to);
  }

  @Get('stories')
  stories(
    @CurrentUserId() userId: string | undefined,
    @Query() query: AnalyticsStoriesRequest,
  ) {
    return this.analytics.stories(userId, query);
  }

  @Get('stories/:storyId')
  story(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Query() query: AnalyticsDateRangeRequest,
  ) {
    return this.analytics.story(userId, storyId, query.from, query.to);
  }
}
