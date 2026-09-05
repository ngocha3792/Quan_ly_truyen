import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '@/common/decorators';
import {
  GetPublicChapterReaderQuery,
  GetPublicChapterReaderQueryHandler,
  ListPublicStoryChaptersQuery,
  ListPublicStoryChaptersQueryHandler,
} from '../../../application';
import { ListPublicStoryChaptersRequest } from '../requests';
import {
  type PublicChapterReaderResponse,
  type PublicStoryChapterListResponse,
  toPublicChapterReaderResponse,
  toPublicStoryChapterListResponse,
} from '../responses';

@Controller('stories')
@Public()
export class PublicChaptersController {
  constructor(
    private readonly getChapterReader: GetPublicChapterReaderQueryHandler,
    private readonly listChapters: ListPublicStoryChaptersQueryHandler,
  ) {}

  @Get(':storySlug/chapters')
  async list(
    @Param('storySlug') storySlug: string,
    @Query() request: ListPublicStoryChaptersRequest,
  ): Promise<PublicStoryChapterListResponse> {
    const result = await this.listChapters.execute(
      new ListPublicStoryChaptersQuery(
        storySlug,
        request.page,
        request.pageSize,
      ),
    );

    return toPublicStoryChapterListResponse(result);
  }

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
