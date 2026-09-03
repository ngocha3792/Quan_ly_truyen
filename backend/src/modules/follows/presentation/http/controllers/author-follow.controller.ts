import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import {
  FollowAuthorCommand,
  FollowAuthorCommandHandler,
  FollowStoryCommand,
  FollowStoryCommandHandler,
  GetStoryFollowQuery,
  GetStoryFollowQueryHandler,
  ListFollowingQuery,
  ListFollowingQueryHandler,
  ListStoryFollowsQuery,
  ListStoryFollowsQueryHandler,
  UnfollowAuthorCommand,
  UnfollowAuthorCommandHandler,
  UnfollowStoryCommand,
  UnfollowStoryCommandHandler,
  type AuthorFollowMutationView,
  type FollowingListView,
  type StoryFollowView,
} from '../../../application';
import { ListFollowingRequest } from '../requests/list-following.request';
import { ListStoryFollowsRequest } from '../requests/list-story-follows.request';

@Controller()
@RequirePermissions(PermissionCode.FOLLOW_MANAGE_OWN)
export class AuthorFollowController {
  constructor(
    private readonly followAuthor: FollowAuthorCommandHandler,
    private readonly unfollowAuthor: UnfollowAuthorCommandHandler,
    private readonly listFollowing: ListFollowingQueryHandler,
    private readonly followStoryHandler: FollowStoryCommandHandler,
    private readonly unfollowStoryHandler: UnfollowStoryCommandHandler,
    private readonly getStoryFollowHandler: GetStoryFollowQueryHandler,
    private readonly listStoryFollowsHandler: ListStoryFollowsQueryHandler,
  ) {}

  @Post('authors/:authorId/follow')
  follow(
    @CurrentUserId() userId: string | undefined,
    @Param('authorId', new ParseUUIDPipe({ version: '4' })) authorId: string,
  ): Promise<AuthorFollowMutationView> {
    return this.followAuthor.execute(
      new FollowAuthorCommand(this.requireUserId(userId), authorId),
    );
  }

  @Delete('authors/:authorId/follow')
  unfollow(
    @CurrentUserId() userId: string | undefined,
    @Param('authorId', new ParseUUIDPipe({ version: '4' })) authorId: string,
  ): Promise<AuthorFollowMutationView> {
    return this.unfollowAuthor.execute(
      new UnfollowAuthorCommand(this.requireUserId(userId), authorId),
    );
  }

  @Get('me/following')
  list(
    @CurrentUserId() userId: string | undefined,
    @Query() query: ListFollowingRequest,
  ): Promise<FollowingListView> {
    return this.listFollowing.execute(
      new ListFollowingQuery({
        userId: this.requireUserId(userId),
        page: query.page,
        pageSize: query.pageSize,
        authorIds: query.authorIds,
      }),
    );
  }

  @Post('stories/:storyId/follow')
  followStory(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
  ): Promise<StoryFollowView> {
    return this.followStoryHandler.execute(
      new FollowStoryCommand(this.requireUserId(userId), storyId),
    );
  }

  @Delete('stories/:storyId/follow')
  unfollowStory(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
  ): Promise<StoryFollowView> {
    return this.unfollowStoryHandler.execute(
      new UnfollowStoryCommand(this.requireUserId(userId), storyId),
    );
  }

  @Get('stories/:storyId/follow')
  getStoryFollow(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
  ): Promise<StoryFollowView> {
    return this.getStoryFollowHandler.execute(
      new GetStoryFollowQuery(this.requireUserId(userId), storyId),
    );
  }

  @Get('me/story-follows')
  listStoryFollows(
    @CurrentUserId() userId: string | undefined,
    @Query() query: ListStoryFollowsRequest,
  ): Promise<readonly string[]> {
    return this.listStoryFollowsHandler.execute(
      new ListStoryFollowsQuery(this.requireUserId(userId), query.storyIds),
    );
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}
