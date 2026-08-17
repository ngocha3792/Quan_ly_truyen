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
  RequirePermissions,
} from '@/common/decorators';
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';

import {
  CreateStoryCommentCommand,
  CreateStoryCommentCommandHandler,
  DeleteStoryCommentCommand,
  DeleteStoryCommentCommandHandler,
  UpdateStoryCommentCommand,
  UpdateStoryCommentCommandHandler,
  type StoryCommentResultDto,
} from '../../../application';
import {
  CreateStoryCommentRequest,
  UpdateStoryCommentRequest,
} from '../requests';

@Controller()
export class ReaderEngagementController {
  constructor(
    private readonly createCommentCommand: CreateStoryCommentCommandHandler,
    private readonly updateCommentCommand: UpdateStoryCommentCommandHandler,
    private readonly deleteCommentCommand: DeleteStoryCommentCommandHandler,
  ) {}

  @Post('stories/:storyId/comments')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.COMMENT_CREATE)
  createStoryComment(
    @CurrentUserId() userId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Body() request: CreateStoryCommentRequest,
  ): Promise<StoryCommentResultDto> {
    return this.createCommentCommand.execute(
      new CreateStoryCommentCommand(
        userId,
        storyId,
        request.body,
        undefined,
        ipAddress,
      ),
    );
  }

  @Post('stories/:storyId/chapters/:chapterId/comments')
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.COMMENT_CREATE)
  createChapterComment(
    @CurrentUserId() userId: string | undefined,
    @ClientIp() ipAddress: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @Body() request: CreateStoryCommentRequest,
  ): Promise<StoryCommentResultDto> {
    return this.createCommentCommand.execute(
      new CreateStoryCommentCommand(
        userId,
        storyId,
        request.body,
        chapterId,
        ipAddress,
      ),
    );
  }

  @Patch('comments/:commentId')
  @RequirePermissions(PermissionCode.COMMENT_UPDATE_OWN)
  updateComment(
    @CurrentUserId() userId: string | undefined,
    @Param('commentId', new ParseUUIDPipe({ version: '4' })) commentId: string,
    @Body() request: UpdateStoryCommentRequest,
  ): Promise<StoryCommentResultDto> {
    return this.updateCommentCommand.execute(
      new UpdateStoryCommentCommand(userId, commentId, request.body),
    );
  }

  @Delete('comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PermissionCode.COMMENT_DELETE_OWN)
  async deleteComment(
    @CurrentUserId() userId: string | undefined,
    @Param('commentId', new ParseUUIDPipe({ version: '4' })) commentId: string,
  ): Promise<void> {
    await this.deleteCommentCommand.execute(
      new DeleteStoryCommentCommand(userId, commentId),
    );
  }
}
