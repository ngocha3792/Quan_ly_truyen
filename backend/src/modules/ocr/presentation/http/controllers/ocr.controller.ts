import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  CurrentUserId,
  Idempotent,
  RequirePermissions,
} from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  GetChapterOcrQueryHandler,
  RequestChapterOcrCommandHandler,
} from '../../../application';
import { OcrFeatureGuard } from '../guards';
import { RequestChapterOcrRequest } from '../requests';
import { ChapterOcrResponse, RequestChapterOcrResponse } from '../responses';

@Controller('ocr')
@UseGuards(OcrFeatureGuard)
export class OcrController {
  constructor(
    private readonly requestChapter: RequestChapterOcrCommandHandler,
    private readonly getChapter: GetChapterOcrQueryHandler,
  ) {}

  @Post('chapters/:chapterId')
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent()
  @RequirePermissions(PermissionCode.CHAPTER_UPDATE_OWN)
  async request(
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @CurrentUserId() userId: string,
    @Body() body: RequestChapterOcrRequest,
  ): Promise<RequestChapterOcrResponse> {
    const result = await this.requestChapter.execute({
      chapterId,
      requestedById: userId,
      ...(body.language ? { language: body.language } : {}),
    });

    return {
      chapterId: result.chapterId,
      language: result.language,
      queuedPages: result.queuedPages,
      jobId: result.jobId,
    };
  }

  @Get('chapters/:chapterId')
  @RequirePermissions(PermissionCode.CHAPTER_UPDATE_OWN)
  async read(
    @Param('chapterId', ParseUUIDPipe) chapterId: string,
    @Query('language') language?: string,
  ): Promise<ChapterOcrResponse> {
    const result = await this.getChapter.execute({
      chapterId,
      ...(language ? { language } : {}),
    });

    return {
      chapterId: result.chapterId,
      language: result.language,
      pages: result.pages.map((page) => ({
        mediaAssetId: page.mediaAssetId,
        sortOrder: page.sortOrder,
        status: page.status,
        text: page.text,
        lineCount: page.lineCount,
        failureReason: page.failureReason,
        completedAt: page.completedAt?.toISOString() ?? null,
        lines: page.lines.map((line) => ({
          text: line.text,
          confidence: line.confidence,
          box: line.box,
        })),
      })),
    };
  }
}
