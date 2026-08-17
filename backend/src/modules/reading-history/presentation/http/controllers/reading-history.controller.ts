import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  ClearReadingHistoryCommand,
  ClearReadingHistoryCommandHandler,
  ListReadingHistoryQuery,
  ListReadingHistoryQueryHandler,
  RemoveReadingHistoryEntryCommand,
  RemoveReadingHistoryEntryCommandHandler,
  SaveReadingProgressCommand,
  SaveReadingProgressCommandHandler,
  type ReadingHistoryEntryResultDto,
} from '../../../application';
import { SaveReadingProgressRequest } from '../requests';

@Controller()
export class ReadingHistoryController {
  constructor(
    private readonly listHistoryQuery: ListReadingHistoryQueryHandler,
    private readonly saveProgressCommand: SaveReadingProgressCommandHandler,
    private readonly removeHistoryCommand: RemoveReadingHistoryEntryCommandHandler,
    private readonly clearHistoryCommand: ClearReadingHistoryCommandHandler,
  ) {}

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
}
