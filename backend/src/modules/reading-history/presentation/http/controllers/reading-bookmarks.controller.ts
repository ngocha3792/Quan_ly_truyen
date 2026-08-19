import {
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
  GetReadingBookmarkQuery,
  GetReadingBookmarkQueryHandler,
  ListReadingBookmarksQuery,
  ListReadingBookmarksQueryHandler,
  RemoveReadingBookmarkCommand,
  RemoveReadingBookmarkCommandHandler,
  UpsertReadingBookmarkCommand,
  UpsertReadingBookmarkCommandHandler,
  type ReadingBookmarkResultDto,
} from '../../../application';

@Controller('reading-bookmarks')
@RequirePermissions(PermissionCode.READING_BOOKMARK_MANAGE_OWN)
export class ReadingBookmarksController {
  constructor(
    private readonly listBookmarksQuery: ListReadingBookmarksQueryHandler,
    private readonly getBookmarkQuery: GetReadingBookmarkQueryHandler,
    private readonly upsertBookmarkCommand: UpsertReadingBookmarkCommandHandler,
    private readonly removeBookmarkCommand: RemoveReadingBookmarkCommandHandler,
  ) {}

  @Get()
  listBookmarks(
    @CurrentUserId() userId: string | undefined,
  ): Promise<readonly ReadingBookmarkResultDto[]> {
    return this.listBookmarksQuery.execute(
      new ListReadingBookmarksQuery(userId),
    );
  }

  @Get(':chapterId')
  getBookmark(
    @CurrentUserId() userId: string | undefined,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
  ): Promise<ReadingBookmarkResultDto | null> {
    return this.getBookmarkQuery.execute(
      new GetReadingBookmarkQuery(userId, chapterId),
    );
  }

  @Put(':chapterId')
  upsertBookmark(
    @CurrentUserId() userId: string | undefined,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
  ): Promise<ReadingBookmarkResultDto> {
    return this.upsertBookmarkCommand.execute(
      new UpsertReadingBookmarkCommand(userId, chapterId),
    );
  }

  @Delete(':chapterId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeBookmark(
    @CurrentUserId() userId: string | undefined,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
  ): Promise<void> {
    await this.removeBookmarkCommand.execute(
      new RemoveReadingBookmarkCommand(userId, chapterId),
    );
  }
}
