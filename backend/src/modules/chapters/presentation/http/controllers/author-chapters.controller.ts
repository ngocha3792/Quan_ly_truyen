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
  UseGuards,
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
import { ActiveAuthorGuard } from '@/modules/authors';

import {
  CreateAuthorChapterCommand,
  CreateAuthorChapterCommandHandler,
  DeleteAuthorChapterCommand,
  DeleteAuthorChapterCommandHandler,
  GetAuthorChapterQuery,
  GetAuthorChapterQueryHandler,
  ListAuthorChaptersQuery,
  ListAuthorChaptersQueryHandler,
  PublishAuthorChapterCommand,
  PublishAuthorChapterCommandHandler,
  UpdateAuthorChapterCommand,
  UpdateAuthorChapterCommandHandler,
} from '../../../application';
import {
  CreateAuthorChapterRequest,
  UpdateAuthorChapterRequest,
} from '../requests';
import {
  type ChapterResponse,
  type ChapterSummaryResponse,
  toChapterResponse,
  toChapterSummaryResponse,
} from '../responses';

@Controller('author/stories/:storyId/chapters')
@UseGuards(ActiveAuthorGuard)
export class AuthorChaptersController {
  constructor(
    private readonly createChapter: CreateAuthorChapterCommandHandler,
    private readonly updateChapter: UpdateAuthorChapterCommandHandler,
    private readonly deleteChapter: DeleteAuthorChapterCommandHandler,
    private readonly listChapters: ListAuthorChaptersQueryHandler,
    private readonly getChapter: GetAuthorChapterQueryHandler,
    private readonly publishChapter: PublishAuthorChapterCommandHandler,
  ) {}

  @Get()
  @RequirePermissions(PermissionCode.STORY_CREATE)
  async list(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
  ): Promise<readonly ChapterSummaryResponse[]> {
    const results = await this.listChapters.execute(
      new ListAuthorChaptersQuery(userId, storyId),
    );

    return results.map((result) => toChapterSummaryResponse(result));
  }

  @Get(':chapterId')
  @RequirePermissions(PermissionCode.STORY_CREATE)
  async findOne(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
  ): Promise<ChapterResponse> {
    const result = await this.getChapter.execute(
      new GetAuthorChapterQuery(userId, storyId, chapterId),
    );

    return toChapterResponse(result);
  }

  @Post()
  @Idempotent({ required: true, ttlSeconds: 86_400 })
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

  @Post(':chapterId/publish')
  @HttpCode(HttpStatus.OK)
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.CHAPTER_PUBLISH_OWN)
  async publish(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<ChapterResponse> {
    const result = await this.publishChapter.execute(
      new PublishAuthorChapterCommand(
        userId,
        storyId,
        chapterId,
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
