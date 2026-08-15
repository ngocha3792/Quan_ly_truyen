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
  CreateAuthorChapterCommand,
  CreateAuthorChapterCommandHandler,
  DeleteAuthorChapterCommand,
  DeleteAuthorChapterCommandHandler,
  UpdateAuthorChapterCommand,
  UpdateAuthorChapterCommandHandler,
} from '../../../application';
import {
  CreateAuthorChapterRequest,
  UpdateAuthorChapterRequest,
} from '../requests';
import { type ChapterResponse, toChapterResponse } from '../responses';

@Controller('author/stories/:storyId/chapters')
export class AuthorChaptersController {
  constructor(
    private readonly createChapter: CreateAuthorChapterCommandHandler,
    private readonly updateChapter: UpdateAuthorChapterCommandHandler,
    private readonly deleteChapter: DeleteAuthorChapterCommandHandler,
  ) {}

  @Post()
  @RequirePermissions(PermissionCode.CHAPTER_CREATE)
  async create(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Body() request: CreateAuthorChapterRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<ChapterResponse> {
    const result = await this.createChapter.execute(
      new CreateAuthorChapterCommand(
        userId,
        storyId,
        request.title,
        request.content,
        ipAddress,
        userAgent,
        requestId,
      ),
    );

    return toChapterResponse(result);
  }

  @Patch(':chapterId')
  @RequirePermissions(PermissionCode.CHAPTER_UPDATE_OWN)
  async update(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @Body() request: UpdateAuthorChapterRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<ChapterResponse> {
    const result = await this.updateChapter.execute(
      new UpdateAuthorChapterCommand(
        userId,
        storyId,
        chapterId,
        request.title,
        request.content,
        ipAddress,
        userAgent,
        requestId,
      ),
    );

    return toChapterResponse(result);
  }

  @Delete(':chapterId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PermissionCode.CHAPTER_DELETE_OWN)
  async remove(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<void> {
    await this.deleteChapter.execute(
      new DeleteAuthorChapterCommand(
        userId,
        storyId,
        chapterId,
        ipAddress,
        userAgent,
        requestId,
      ),
    );
  }
}
