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
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';

import {
  CancelAuthorStorySubmissionCommand,
  CancelAuthorStorySubmissionCommandHandler,
  CreateAuthorStoryCommand,
  CreateAuthorStoryCommandHandler,
  DeleteAuthorStoryCommand,
  DeleteAuthorStoryCommandHandler,
  SubmitAuthorStoryCommand,
  SubmitAuthorStoryCommandHandler,
  UpdateAuthorStoryCommand,
  UpdateAuthorStoryCommandHandler,
} from '../../../application';
import {
  CreateAuthorStoryRequest,
  SubmitAuthorStoryRequest,
  UpdateAuthorStoryRequest,
} from '../requests';
import {
  type StoryPublicationResponse,
  type StoryResponse,
  toStoryPublicationResponse,
  toStoryResponse,
} from '../responses';

@Controller('author/stories')
export class AuthorStoriesController {
  constructor(
    private readonly createStory: CreateAuthorStoryCommandHandler,
    private readonly updateStory: UpdateAuthorStoryCommandHandler,
    private readonly deleteStory: DeleteAuthorStoryCommandHandler,
    private readonly submitStory: SubmitAuthorStoryCommandHandler,
    private readonly cancelSubmission: CancelAuthorStorySubmissionCommandHandler,
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
        request.categoryIds,
        request.tagIds,
        ipAddress,
        userAgent,
        requestId,
      ),
    );

    return toStoryResponse(result);
  }

  @Post(':storyId/submit')
  @HttpCode(HttpStatus.OK)
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.STORY_SUBMIT)
  async submit(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Body() request: SubmitAuthorStoryRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<StoryPublicationResponse> {
    const result = await this.submitStory.execute(
      new SubmitAuthorStoryCommand(
        userId,
        storyId,
        request.authorNote,
        ipAddress,
        userAgent,
        requestId,
      ),
    );

    return toStoryPublicationResponse(result);
  }

  @Post(':storyId/submission/cancel')
  @HttpCode(HttpStatus.OK)
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.STORY_SUBMIT)
  async cancelReview(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<StoryPublicationResponse> {
    const result = await this.cancelSubmission.execute(
      new CancelAuthorStorySubmissionCommand(
        userId,
        storyId,
        ipAddress,
        userAgent,
        requestId,
      ),
    );

    return toStoryPublicationResponse(result);
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
        request.categoryIds,
        request.tagIds,
        request.coverMediaId,
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
