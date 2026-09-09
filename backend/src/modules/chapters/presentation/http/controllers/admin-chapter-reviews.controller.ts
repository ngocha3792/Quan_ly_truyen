import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { ChapterWorkflowQueryHandler } from '../../../application/queries/chapter-workflow/chapter-workflow.query-handler';
import {
  ListChapterReviewsRequest,
  ReviewChapterRequest,
} from '../requests/chapter-workflow.request';
import { toChapterResponse } from '../responses';

@Controller('admin/chapter-reviews')
@RequirePermissions(PermissionCode.CHAPTER_MANAGE_ANY)
export class AdminChapterReviewsController {
  constructor(
    private readonly commands: ChapterWorkflowCommandHandler,
    private readonly queries: ChapterWorkflowQueryHandler,
  ) {}

  @Get()
  async list(
    @CurrentUserId() userId: string | undefined,
    @Query() query: ListChapterReviewsRequest,
  ) {
    const page = await this.queries.list(userId, query.page, query.pageSize);
    return {
      ...page,
      items: page.items.map(({ chapter, ...workflow }) => ({
        ...workflow,
        chapter: toChapterResponse(chapter),
      })),
    };
  }

  @Get(':chapterId')
  async get(
    @CurrentUserId() userId: string | undefined,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
  ) {
    const { chapter, ...workflow } = await this.queries.get(userId, chapterId);
    return { ...workflow, chapter: toChapterResponse(chapter) };
  }

  @Post(':chapterId')
  @HttpCode(200)
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  async review(
    @CurrentUserId() userId: string | undefined,
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Body() request: ReviewChapterRequest,
    @ClientIp() ipAddress?: string,
    @UserAgent() userAgent?: string,
    @RequestId() requestId?: string,
  ) {
    return toChapterResponse(
      await this.commands.execute({
        userId,
        chapterId,
        expectedVersion: request.expectedVersion,
        action: request.decision,
        comment: request.comment,
        audit: { ipAddress, userAgent, requestId },
      }),
    );
  }
}
