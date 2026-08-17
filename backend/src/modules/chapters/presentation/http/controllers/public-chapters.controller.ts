import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '@/common/decorators';
import {
  GetPublicChapterReaderQuery,
  GetPublicChapterReaderQueryHandler,
} from '../../../application';
import {
  type PublicChapterReaderResponse,
  toPublicChapterReaderResponse,
} from '../responses';

@Controller('stories')
@Public()
export class PublicChaptersController {
  constructor(
    private readonly getChapterReader: GetPublicChapterReaderQueryHandler,
  ) {}

  @Get(':storySlug/chapters/:chapterNumber')
  async chapterReader(
    @Param('storySlug') storySlug: string,
    @Param('chapterNumber') chapterNumber: string,
  ): Promise<PublicChapterReaderResponse> {
    const result = await this.getChapterReader.execute(
      new GetPublicChapterReaderQuery(storySlug, chapterNumber),
    );

    return toPublicChapterReaderResponse(result);
  }
}
