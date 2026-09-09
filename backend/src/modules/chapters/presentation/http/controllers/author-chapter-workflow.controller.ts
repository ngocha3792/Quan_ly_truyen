import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { ChapterWorkflowCommandHandler } from '../../../application/commands/chapter-workflow/chapter-workflow.command-handler';
import { ChapterEditSessionCommandHandler } from '../../../application/commands/chapter-edit-session/chapter-edit-session.command-handler';
import { ChapterWorkflowQueryHandler } from '../../../application/queries/chapter-workflow/chapter-workflow.query-handler';
import {
  ChapterEditSessionRequest,
  ChapterWorkflowRequest,
} from '../requests/chapter-workflow.request';
import { toChapterResponse } from '../responses';

@Controller('author/stories/:storyId/chapters/:chapterId')
@RequirePermissions(PermissionCode.STORY_READ)
export class AuthorChapterWorkflowController {
  constructor(
    private readonly commands: ChapterWorkflowCommandHandler,
    private readonly queries: ChapterWorkflowQueryHandler,
    private readonly sessions: ChapterEditSessionCommandHandler,
  ) {}

  @Get('workflow')
  async workflow(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
  ) {
    const { chapter, ...workflow } = await this.queries.get(
      userId,
      chapterId,
      storyId,
    );
    return { ...workflow, status: chapter.status, version: chapter.version };
  }

  @Post('submit-review')
  @HttpCode(200)
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  async submit(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Body() request: ChapterWorkflowRequest,
    @ClientIp() ipAddress?: string,
    @UserAgent() userAgent?: string,
    @RequestId() requestId?: string,
  ) {
    return toChapterResponse(
      await this.commands.execute({
        userId,
        storyId,
        chapterId,
        expectedVersion: request.expectedVersion,
        action: 'submit',
        audit: { ipAddress, userAgent, requestId },
      }),
    );
  }

  @Post('reopen')
  @HttpCode(200)
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  async reopen(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Body() request: ChapterWorkflowRequest,
    @ClientIp() ipAddress?: string,
    @UserAgent() userAgent?: string,
    @RequestId() requestId?: string,
  ) {
    return toChapterResponse(
      await this.commands.execute({
        userId,
        storyId,
        chapterId,
        expectedVersion: request.expectedVersion,
        action: 'reopen',
        audit: { ipAddress, userAgent, requestId },
      }),
    );
  }

  @Get('edit-sessions')
  list(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
  ) {
    return this.sessions.list(userId, storyId, chapterId);
  }

  @Post('edit-sessions')
  create(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Body() request: ChapterEditSessionRequest,
  ) {
    return this.sessions.save(userId, storyId, chapterId, request.tabId);
  }

  @Put('edit-sessions/:sessionToken')
  heartbeat(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Param('sessionToken') token: string,
    @Body() request: ChapterEditSessionRequest,
  ) {
    return this.sessions.save(userId, storyId, chapterId, request.tabId, token);
  }

  @Delete('edit-sessions/:sessionToken')
  @HttpCode(204)
  remove(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Param('sessionToken') token: string,
  ) {
    return this.sessions.remove(userId, storyId, chapterId, token);
  }
}
