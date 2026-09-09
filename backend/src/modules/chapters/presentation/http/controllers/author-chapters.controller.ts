import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
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
import { ChapterExpectedVersionRequest } from '../requests/chapter-expected-version.request';
import { ChapterVersionDiffRequest } from '../requests/chapter-version-diff.request';
import { GetVersionDiffQueryHandler } from '../../../application/queries/get-version-diff/get-version-diff.query-handler';

import {
  CreateAuthorChapterCommand,
  CreateAuthorChapterCommandHandler,
  DeleteAuthorChapterCommand,
  DeleteAuthorChapterCommandHandler,
  GetAuthorChapterQuery,
  GetAuthorChapterQueryHandler,
  GetAuthorChapterVersionQuery,
  GetAuthorChapterVersionQueryHandler,
  ListAuthorChaptersQuery,
  ListAuthorChaptersQueryHandler,
  ListAuthorChapterVersionsQuery,
  ListAuthorChapterVersionsQueryHandler,
  PublishAuthorChapterCommand,
  PublishAuthorChapterCommandHandler,
  ScheduleAuthorChapterCommand,
  ScheduleAuthorChapterCommandHandler,
  CancelAuthorChapterScheduleCommand,
  CancelAuthorChapterScheduleCommandHandler,
  UpdateAuthorChapterCommand,
  UpdateAuthorChapterCommandHandler,
  RestoreAuthorChapterVersionCommand,
  RestoreAuthorChapterVersionCommandHandler,
} from '../../../application';
import {
  CreateAuthorChapterRequest,
  ListAuthorChapterVersionsRequest,
  ScheduleAuthorChapterRequest,
  UpdateAuthorChapterRequest,
} from '../requests';
import {
  type ChapterResponse,
  type ChapterSummaryResponse,
  type ChapterVersionPageResponse,
  type ChapterVersionResponse,
  toChapterResponse,
  toChapterSummaryResponse,
  toChapterVersionPageResponse,
  toChapterVersionResponse,
} from '../responses';

@Controller('author/stories/:storyId/chapters')
export class AuthorChaptersController {
  constructor(
    private readonly versionDiff: GetVersionDiffQueryHandler,
    private readonly createChapter: CreateAuthorChapterCommandHandler,
    private readonly updateChapter: UpdateAuthorChapterCommandHandler,
    private readonly deleteChapter: DeleteAuthorChapterCommandHandler,
    private readonly listChapters: ListAuthorChaptersQueryHandler,
    private readonly getChapter: GetAuthorChapterQueryHandler,
    private readonly listChapterVersions: ListAuthorChapterVersionsQueryHandler,
    private readonly getChapterVersion: GetAuthorChapterVersionQueryHandler,
    private readonly restoreChapterVersion: RestoreAuthorChapterVersionCommandHandler,
    private readonly publishChapter: PublishAuthorChapterCommandHandler,
    private readonly scheduleChapter: ScheduleAuthorChapterCommandHandler,
    private readonly cancelChapterSchedule: CancelAuthorChapterScheduleCommandHandler,
  ) {}

  @Get(':chapterId/versions')
  @RequirePermissions(PermissionCode.STORY_READ)
  async listVersions(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @Query() request: ListAuthorChapterVersionsRequest,
  ): Promise<ChapterVersionPageResponse> {
    const result = await this.listChapterVersions.execute(
      new ListAuthorChapterVersionsQuery(
        userId,
        storyId,
        chapterId,
        request.page,
        request.pageSize,
        request.includeAutosaves,
      ),
    );

    return toChapterVersionPageResponse(result);
  }

  @Get(':chapterId/versions/diff')
  @RequirePermissions(PermissionCode.STORY_READ)
  diffVersions(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @Query() request: ChapterVersionDiffRequest,
  ) {
    return this.versionDiff.execute(
      userId,
      storyId,
      chapterId,
      request.from,
      request.to,
    );
  }

  @Get(':chapterId/versions/:version')
  @RequirePermissions(PermissionCode.STORY_READ)
  async findVersion(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<ChapterVersionResponse> {
    const result = await this.getChapterVersion.execute(
      new GetAuthorChapterVersionQuery(userId, storyId, chapterId, version),
    );

    return toChapterVersionResponse(result);
  }

  @Post(':chapterId/versions/:version/restore')
  @HttpCode(HttpStatus.OK)
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  @RequirePermissions(PermissionCode.STORY_READ)
  async restoreVersion(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() request: ChapterExpectedVersionRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<ChapterResponse> {
    const result = await this.restoreChapterVersion.execute(
      new RestoreAuthorChapterVersionCommand(
        userId,
        storyId,
        chapterId,
        version,
        ipAddress,
        userAgent,
        requestId,
        request.expectedVersion,
      ),
    );

    return toChapterResponse(result);
  }

  @Get()
  @RequirePermissions(PermissionCode.STORY_READ)
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
  @RequirePermissions(PermissionCode.STORY_READ)
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
  @UseGuards(ActiveAuthorGuard)
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
  @UseGuards(ActiveAuthorGuard)
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

  @Put(':chapterId/schedule')
  @UseGuards(ActiveAuthorGuard)
  @RequirePermissions(PermissionCode.CHAPTER_PUBLISH_OWN)
  async schedule(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @Body() request: ScheduleAuthorChapterRequest,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<ChapterResponse> {
    const result = await this.scheduleChapter.execute(
      new ScheduleAuthorChapterCommand(
        userId,
        storyId,
        chapterId,
        request.scheduledAt,
        ipAddress,
        userAgent,
        requestId,
      ),
    );

    return toChapterResponse(result);
  }

  @Delete(':chapterId/schedule')
  @UseGuards(ActiveAuthorGuard)
  @RequirePermissions(PermissionCode.CHAPTER_PUBLISH_OWN)
  async cancelSchedule(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @ClientIp() ipAddress: string | undefined,
    @UserAgent() userAgent: string | undefined,
    @RequestId() requestId: string | undefined,
  ): Promise<ChapterResponse> {
    const result = await this.cancelChapterSchedule.execute(
      new CancelAuthorChapterScheduleCommand(
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
  @RequirePermissions(PermissionCode.STORY_READ)
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
        request.expectedVersion,
      ),
    );

    return toChapterResponse(result);
  }

  @Delete(':chapterId')
  @UseGuards(ActiveAuthorGuard)
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
