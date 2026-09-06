import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';
import { ActiveAuthorGuard } from '@/modules/authors';

import {
  GetChapterTranslationQuery,
  GetChapterTranslationQueryHandler,
  RequestChapterTranslationCommand,
  RequestChapterTranslationCommandHandler,
} from '../../../application';
import { RequestChapterTranslationRequest } from '../requests';
import {
  ChapterTranslationResponse,
  RequestChapterTranslationResponse,
  toChapterTranslationResponse,
  toRequestChapterTranslationResponse,
} from '../responses';

@Controller('author/stories/:storyId/chapters/:chapterId/translations')
@UseGuards(ActiveAuthorGuard)
export class ChapterTranslationsController {
  constructor(
    private readonly requestTranslation: RequestChapterTranslationCommandHandler,
    private readonly getTranslation: GetChapterTranslationQueryHandler,
  ) {}

  @Post(':targetLanguageCode')
  @HttpCode(HttpStatus.OK)
  @Idempotent({ required: false, ttlSeconds: 300 })
  @RequirePermissions(PermissionCode.CHAPTER_UPDATE_OWN)
  async request(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @Param('targetLanguageCode') targetLanguageCode: string,
    @Body() request: RequestChapterTranslationRequest,
  ): Promise<RequestChapterTranslationResponse> {
    const result = await this.requestTranslation.execute(
      new RequestChapterTranslationCommand(
        this.requireUserId(userId),
        storyId,
        chapterId,
        targetLanguageCode,
        request.connectionId,
      ),
    );

    return toRequestChapterTranslationResponse(result);
  }

  @Get(':targetLanguageCode')
  @RequirePermissions(PermissionCode.CHAPTER_UPDATE_OWN)
  async get(
    @CurrentUserId() userId: string | undefined,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @Param('targetLanguageCode') targetLanguageCode: string,
  ): Promise<ChapterTranslationResponse | null> {
    const result = await this.getTranslation.execute(
      new GetChapterTranslationQuery(
        this.requireUserId(userId),
        storyId,
        chapterId,
        targetLanguageCode,
      ),
    );

    return result ? toChapterTranslationResponse(result) : null;
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}
