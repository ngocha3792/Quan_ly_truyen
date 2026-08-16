import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UnauthorizedException } from '@nestjs/common';
import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import {
  AuthorFollowService,
  type AuthorFollowMutationView,
  type FollowingListView,
} from '../../../application/services/author-follow.service';
import { ListFollowingRequest } from '../requests/list-following.request';

@Controller()
@RequirePermissions(PermissionCode.FOLLOW_MANAGE_OWN)
export class AuthorFollowController {
  constructor(private readonly follows: AuthorFollowService) {}

  @Post('authors/:authorId/follow')
  follow(
    @CurrentUserId() userId: string | undefined,
    @Param('authorId', new ParseUUIDPipe({ version: '4' })) authorId: string,
  ): Promise<AuthorFollowMutationView> {
    return this.follows.follow(this.requireUserId(userId), authorId);
  }

  @Delete('authors/:authorId/follow')
  unfollow(
    @CurrentUserId() userId: string | undefined,
    @Param('authorId', new ParseUUIDPipe({ version: '4' })) authorId: string,
  ): Promise<AuthorFollowMutationView> {
    return this.follows.unfollow(this.requireUserId(userId), authorId);
  }

  @Get('me/following')
  list(
    @CurrentUserId() userId: string | undefined,
    @Query() query: ListFollowingRequest,
  ): Promise<FollowingListView> {
    return this.follows.list({
      userId: this.requireUserId(userId),
      page: query.page,
      pageSize: query.pageSize,
      authorIds: query.authorIds,
    });
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}
