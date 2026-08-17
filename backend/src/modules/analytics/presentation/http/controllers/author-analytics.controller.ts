import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import {
  GetAuthorAnalyticsOverviewQuery, GetAuthorAnalyticsOverviewQueryHandler,
  GetAuthorStoryAnalyticsQuery, GetAuthorStoryAnalyticsQueryHandler,
  ListAuthorStoryAnalyticsQuery, ListAuthorStoryAnalyticsQueryHandler,
} from '../../../application';
import {
  AnalyticsDateRangeRequest,
  AnalyticsStoriesRequest,
} from '../requests/analytics-date-range.request';

@Controller('author/analytics')
@RequirePermissions(PermissionCode.ANALYTICS_READ)
export class AuthorAnalyticsController {
  constructor(
    private readonly overviewHandler: GetAuthorAnalyticsOverviewQueryHandler,
    private readonly storiesHandler: ListAuthorStoryAnalyticsQueryHandler,
    private readonly storyHandler: GetAuthorStoryAnalyticsQueryHandler,
  ) {}

  @Get('overview')
  overview(
    @CurrentUserId() userId: string | undefined,
    @Query() query: AnalyticsDateRangeRequest,
  ) {
    return this.overviewHandler.execute(new GetAuthorAnalyticsOverviewQuery(userId, query.from, query.to));
  }

  @Get('stories')
  stories(
    @CurrentUserId() userId: string | undefined,
    @Query() query: AnalyticsStoriesRequest,
  ) {
    return this.storiesHandler.execute(new ListAuthorStoryAnalyticsQuery(userId, query));
  }

  @Get('stories/:storyId')
  story(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Query() query: AnalyticsDateRangeRequest,
  ) {
    return this.storyHandler.execute(new GetAuthorStoryAnalyticsQuery(userId, storyId, query.from, query.to));
  }
}
