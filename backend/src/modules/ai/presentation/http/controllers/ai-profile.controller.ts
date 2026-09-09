import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import { ActiveAuthorGuard } from '@/modules/authors';

import { AiProfileManager } from '../../../application';
import {
  UpdateAiStoryProfileRequest,
  UpdateAiUserProfileRequest,
} from '../requests';
import {
  AiProfileResponse,
  toAiProfileResponse,
} from '../responses/ai-profile.response';

@Controller('ai/profile')
@RequirePermissions(PermissionCode.AI_CHAT_USE)
export class AiProfileController {
  constructor(private readonly profiles: AiProfileManager) {}

  @Get()
  async get(
    @CurrentUserId() userId: string | undefined,
  ): Promise<AiProfileResponse> {
    return toAiProfileResponse(
      await this.profiles.getUser(this.requireUserId(userId)),
    );
  }

  @Patch()
  async update(
    @CurrentUserId() userId: string | undefined,
    @Body() request: UpdateAiUserProfileRequest,
  ): Promise<AiProfileResponse> {
    return toAiProfileResponse(
      await this.profiles.updateUser(this.requireUserId(userId), request),
    );
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}

@Controller('author/stories/:storyId/ai-profile')
@UseGuards(ActiveAuthorGuard)
@RequirePermissions(PermissionCode.CHAPTER_UPDATE_OWN)
export class AiStoryProfileController {
  constructor(private readonly profiles: AiProfileManager) {}

  @Get()
  @RequirePermissions(PermissionCode.STORY_READ)
  async get(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
  ): Promise<AiProfileResponse> {
    return toAiProfileResponse(
      await this.profiles.getStory(this.requireUserId(userId), storyId),
    );
  }

  @Patch()
  async update(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Body() request: UpdateAiStoryProfileRequest,
  ): Promise<AiProfileResponse> {
    return toAiProfileResponse(
      await this.profiles.updateStory(
        this.requireUserId(userId),
        storyId,
        request,
      ),
    );
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}
