import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';

import { ClientIp, CurrentUserId, RequirePermissions } from '@/common/decorators';
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';

import {
  ClearReadingHistoryCommand,
  ClearReadingHistoryCommandHandler,
  CreateStoryCommentCommand,
  CreateStoryCommentCommandHandler,
  DeleteStoryCommentCommand,
  DeleteStoryCommentCommandHandler,
  DeleteStoryRatingCommand,
  DeleteStoryRatingCommandHandler,
  GetMyStoryRatingQuery,
  GetMyStoryRatingQueryHandler,
  ListLibraryQuery,
  ListLibraryQueryHandler,
  ListReadingHistoryQuery,
  ListReadingHistoryQueryHandler,
  RemoveLibraryEntryCommand,
  RemoveLibraryEntryCommandHandler,
  RemoveReadingHistoryEntryCommand,
  RemoveReadingHistoryEntryCommandHandler,
  SaveReadingProgressCommand,
  SaveReadingProgressCommandHandler,
  UpdateStoryCommentCommand,
  UpdateStoryCommentCommandHandler,
  UpsertLibraryEntryCommand,
  UpsertLibraryEntryCommandHandler,
  UpsertStoryRatingCommand,
  UpsertStoryRatingCommandHandler,
  type LibraryEntryResultDto,
  type ReadingHistoryEntryResultDto,
  type StoryCommentResultDto,
  type StoryRatingResultDto,
} from '../../../application';
import {
  CreateStoryCommentRequest,
  SaveReadingProgressRequest,
  UpdateStoryCommentRequest,
  UpsertLibraryEntryRequest,
  UpsertStoryRatingRequest,
} from '../requests';

@Controller()
export class ReaderEngagementController {
  constructor(
    private readonly listLibraryQuery: ListLibraryQueryHandler,
    private readonly upsertLibraryCommand: UpsertLibraryEntryCommandHandler,
    private readonly removeLibraryCommand: RemoveLibraryEntryCommandHandler,
    private readonly listHistoryQuery: ListReadingHistoryQueryHandler,
    private readonly saveProgressCommand: SaveReadingProgressCommandHandler,
    private readonly removeHistoryCommand: RemoveReadingHistoryEntryCommandHandler,
    private readonly clearHistoryCommand: ClearReadingHistoryCommandHandler,
    private readonly getRatingQuery: GetMyStoryRatingQueryHandler,
    private readonly upsertRatingCommand: UpsertStoryRatingCommandHandler,
    private readonly deleteRatingCommand: DeleteStoryRatingCommandHandler,
    private readonly createCommentCommand: CreateStoryCommentCommandHandler,
    private readonly updateCommentCommand: UpdateStoryCommentCommandHandler,
    private readonly deleteCommentCommand: DeleteStoryCommentCommandHandler,
  ) {}

  @Get('library')
  @RequirePermissions(PermissionCode.LIBRARY_MANAGE_OWN)
  listLibrary(
    @CurrentUserId() userId: string | undefined,
  ): Promise<readonly LibraryEntryResultDto[]> {
    return this.listLibraryQuery.execute(new ListLibraryQuery(userId));
  }

  @Put('library/:storyId')
  @RequirePermissions(PermissionCode.LIBRARY_MANAGE_OWN)
  upsertLibrary(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Body() request: UpsertLibraryEntryRequest,
  ): Promise<LibraryEntryResultDto> {
    return this.upsertLibraryCommand.execute(
      new UpsertLibraryEntryCommand(
        userId,
        storyId,
        request.status,
        request.isFavorite,
      ),
    );
  }

  @Delete('library/:storyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PermissionCode.LIBRARY_MANAGE_OWN)
  async removeLibrary(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
  ): Promise<void> {
    await this.removeLibraryCommand.execute(
      new RemoveLibraryEntryCommand(userId, storyId),
    );
  }

  @Get('reading-history')
  @RequirePermissions(PermissionCode.READING_HISTORY_MANAGE_OWN)
  listHistory(
    @CurrentUserId() userId: string | undefined,
  ): Promise<readonly ReadingHistoryEntryResultDto[]> {
    return this.listHistoryQuery.execute(new ListReadingHistoryQuery(userId));
  }

  @Put('reading-progress/:storyId')
  @RequirePermissions(PermissionCode.READING_HISTORY_MANAGE_OWN)
  saveProgress(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Body() request: SaveReadingProgressRequest,
  ): Promise<ReadingHistoryEntryResultDto> {
    return this.saveProgressCommand.execute(
      new SaveReadingProgressCommand(
        userId,
        storyId,
        request.chapterId,
        request.position,
      ),
    );
  }

  @Delete('reading-history/:storyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PermissionCode.READING_HISTORY_MANAGE_OWN)
  async removeHistory(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
  ): Promise<void> {
    await this.removeHistoryCommand.execute(
      new RemoveReadingHistoryEntryCommand(userId, storyId),
    );
  }

  @Delete('reading-history')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PermissionCode.READING_HISTORY_MANAGE_OWN)
  async clearHistory(
    @CurrentUserId() userId: string | undefined,
  ): Promise<void> {
    await this.clearHistoryCommand.execute(
      new ClearReadingHistoryCommand(userId),
    );
  }

  @Get('stories/:storyId/rating/me')
  @RequirePermissions(PermissionCode.RATING_CREATE)
  getMyRating(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
  ): Promise<StoryRatingResultDto | null> {
    return this.getRatingQuery.execute(
      new GetMyStoryRatingQuery(userId, storyId),
    );
  }

  @Put('stories/:storyId/rating')
  @RequirePermissions(
    PermissionCode.RATING_CREATE,
    PermissionCode.RATING_UPDATE_OWN,
  )
  upsertRating(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Body() request: UpsertStoryRatingRequest,
  ): Promise<StoryRatingResultDto> {
    return this.upsertRatingCommand.execute(
      new UpsertStoryRatingCommand(userId, storyId, request.score),
    );
  }

  @Delete('stories/:storyId/rating')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PermissionCode.RATING_UPDATE_OWN)
  async deleteRating(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
  ): Promise<void> {
    await this.deleteRatingCommand.execute(
      new DeleteStoryRatingCommand(userId, storyId),
    );
  }

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
      new CreateStoryCommentCommand(userId, storyId, request.body, undefined, ipAddress),
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
      new CreateStoryCommentCommand(userId, storyId, request.body, chapterId, ipAddress),
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
