import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import { ActiveAuthorGuard } from '@/modules/authors';
import {
  STORY_CONTRIBUTOR_ROLES,
  StoryContributorUseCases,
  type StoryContributorRoleName,
  type StoryContributorView,
} from '../../../application';
import { UpsertStoryContributorRequest } from '../requests';

@Controller('author/stories/:storyId/contributors')
@UseGuards(ActiveAuthorGuard)
@RequirePermissions(PermissionCode.STORY_UPDATE_OWN)
export class AuthorStoryContributorsController {
  constructor(private readonly useCases: StoryContributorUseCases) {}

  @Get()
  list(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
  ): Promise<readonly StoryContributorView[]> {
    return this.useCases.list(this.requireUserId(userId), storyId);
  }

  @Put()
  upsert(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Body() request: UpsertStoryContributorRequest,
  ): Promise<StoryContributorView> {
    return this.useCases.upsert({
      ownerId: this.requireUserId(userId),
      storyId,
      ...request,
    });
  }

  @Delete(':contributorUserId/:role')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('contributorUserId', new ParseUUIDPipe({ version: '4' })) contributorUserId: string,
    @Param('role') role: string,
  ): Promise<void> {
    await this.useCases.remove({
      ownerId: this.requireUserId(userId),
      storyId,
      contributorUserId,
      role: this.parseRole(role),
    });
  }

  private parseRole(role: string): StoryContributorRoleName {
    if (!STORY_CONTRIBUTOR_ROLES.includes(role as StoryContributorRoleName)) {
      throw new BadRequestException('Vai trò cộng tác viên không hợp lệ');
    }

    return role as StoryContributorRoleName;
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}
