import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';
import { AiAuthorJobManager } from '../../../application/author-tools/ai-author-job.manager';
import {
  AiAuthorIssuesRequest,
  CreateAiAuthorJobRequest,
  UpdateAiConsistencyRequest,
  VerifyAiCharacterRequest,
} from '../requests/ai-author.request';

const uuid = new ParseUUIDPipe({ version: '4' });
@Controller('author/stories/:storyId')
@RequirePermissions(PermissionCode.STORY_READ)
export class AiAuthorToolsController {
  constructor(private readonly jobs: AiAuthorJobManager) {}
  @Post('ai-jobs')
  @Idempotent({ required: false, ttlSeconds: 300 })
  create(
    @CurrentUserId() user: string | undefined,
    @Param('storyId', uuid) storyId: string,
    @Body() body: CreateAiAuthorJobRequest,
  ) {
    return this.jobs.create({ ...body, userId: this.user(user), storyId });
  }
  @Get('ai-jobs')
  list(
    @CurrentUserId() user: string | undefined,
    @Param('storyId', uuid) storyId: string,
  ) {
    return this.jobs.list(this.user(user), storyId);
  }
  @Get('ai-jobs/:jobId')
  detail(
    @CurrentUserId() user: string | undefined,
    @Param('storyId', uuid) storyId: string,
    @Param('jobId', uuid) id: string,
  ) {
    return this.jobs.get(this.user(user), storyId, id);
  }
  @Post('ai-jobs/:jobId/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUserId() user: string | undefined,
    @Param('storyId', uuid) storyId: string,
    @Param('jobId', uuid) id: string,
  ) {
    return this.jobs.transition(this.user(user), storyId, id, 'cancel');
  }
  @Post('ai-jobs/:jobId/retry')
  @HttpCode(200)
  retry(
    @CurrentUserId() user: string | undefined,
    @Param('storyId', uuid) storyId: string,
    @Param('jobId', uuid) id: string,
  ) {
    return this.jobs.transition(this.user(user), storyId, id, 'retry');
  }
  @Get('characters')
  characters(
    @CurrentUserId() user: string | undefined,
    @Param('storyId', uuid) storyId: string,
  ) {
    return this.jobs.characters(this.user(user), storyId);
  }
  @Patch('characters/:characterId')
  @HttpCode(204)
  verify(
    @CurrentUserId() user: string | undefined,
    @Param('storyId', uuid) storyId: string,
    @Param('characterId', uuid) id: string,
    @Body() body: VerifyAiCharacterRequest,
  ) {
    return this.jobs.verifyCharacter(
      this.user(user),
      storyId,
      id,
      body.isVerified,
    );
  }
  @Get('consistency-issues')
  issues(
    @CurrentUserId() user: string | undefined,
    @Param('storyId', uuid) storyId: string,
    @Query() query: AiAuthorIssuesRequest,
  ) {
    return this.jobs.issues(this.user(user), storyId, query.chapterId);
  }
  @Patch('consistency-issues/:issueId')
  @HttpCode(204)
  updateIssue(
    @CurrentUserId() user: string | undefined,
    @Param('storyId', uuid) storyId: string,
    @Param('issueId', uuid) id: string,
    @Body() body: UpdateAiConsistencyRequest,
  ) {
    return this.jobs.updateIssue(this.user(user), storyId, id, body);
  }
  private user(user: string | undefined): string {
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
