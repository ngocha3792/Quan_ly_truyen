import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';

import {
  ClientIp,
  CurrentUserId,
  RequestId,
  RequirePermissions,
  UserAgent,
} from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  CreateAuthorStoryCommand,
  CreateAuthorStoryCommandHandler,
  DeleteAuthorStoryCommand,
  DeleteAuthorStoryCommandHandler,
  UpdateAuthorStoryCommand,
  UpdateAuthorStoryCommandHandler,
} from '../../../application';
import {
  CreateAuthorStoryRequest,
  UpdateAuthorStoryRequest,
} from '../requests';
import { type StoryResponse, toStoryResponse } from '../responses';

@Controller('author/stories')
export class AuthorStoriesController {
  constructor(
    private readonly createStory: CreateAuthorStoryCommandHandler,
    private readonly updateStory: UpdateAuthorStoryCommandHandler,
    private readonly deleteStory: DeleteAuthorStoryCommandHandler,
  ) {}

  @Post()
  @RequirePermissions(PermissionCode.STORY_CREATE)
  async create(
    @CurrentUserId() userId: string | undefined,
    @Body() request: CreateAuthorStoryRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<StoryResponse> {
    const result = await this.createStory.execute(
      new CreateAuthorStoryCommand(
        userId,
        request.title,
        request.synopsis,
        ipAddress,
        userAgent,
        requestId,
      ),
    );

    return toStoryResponse(result);
  }

  @Patch(':storyId')
  @RequirePermissions(PermissionCode.STORY_UPDATE_OWN)
  async update(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Body() request: UpdateAuthorStoryRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<StoryResponse> {
    const result = await this.updateStory.execute(
      new UpdateAuthorStoryCommand(
        userId,
        storyId,
        request.title,
        request.synopsis,
        ipAddress,
        userAgent,
        requestId,
      ),
    );

    return toStoryResponse(result);
  }

  @Delete(':storyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PermissionCode.STORY_DELETE_OWN)
  async remove(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<void> {
    await this.deleteStory.execute(
      new DeleteAuthorStoryCommand(
        userId,
        storyId,
        ipAddress,
        userAgent,
        requestId,
      ),
    );
  }
}
