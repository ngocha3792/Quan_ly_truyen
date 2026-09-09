import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  CurrentUserId,
  RequestId,
  RequirePermissions,
} from '@/common/decorators';
import { Idempotent } from '@/common/decorators/interceptor';
import { PermissionCode } from '@/common/enums';
import { ReviewTranslationCommandHandler } from '../../../application/commands/review-translation/review-translation.command-handler';
import { ReviewTranslationRequest } from '../requests/review-translation.request';
import { toChapterTranslationResponse } from '../responses';

@Controller('author/stories/:storyId/chapters/:chapterId/translations')
@RequirePermissions(PermissionCode.STORY_READ)
export class TranslationReviewController {
  constructor(private readonly handler: ReviewTranslationCommandHandler) {}
  @Post(':targetLanguageCode/review')
  @HttpCode(200)
  @Idempotent({ required: true, ttlSeconds: 86400 })
  async review(
    @CurrentUserId() userId: string,
    @Param('storyId', new ParseUUIDPipe({ version: '4' })) storyId: string,
    @Param('chapterId', new ParseUUIDPipe({ version: '4' })) chapterId: string,
    @Param('targetLanguageCode') targetLanguageCode: string,
    @Body() request: ReviewTranslationRequest,
    @RequestId() requestId?: string,
  ) {
    const result = await this.handler.execute({
      ...request,
      userId,
      storyId,
      chapterId,
      targetLanguageCode,
      requestId,
    });
    return {
      translation: toChapterTranslationResponse(result.translation),
      chapter: result.chapter,
    };
  }
}
