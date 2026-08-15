import { Controller, Get, Param, Query } from '@nestjs/common';

import { Public } from '@/common/decorators';

import {
  GetPublicChapterReaderQuery,
  GetPublicChapterReaderQueryHandler,
  GetPublicStoryDetailQuery,
  GetPublicStoryDetailQueryHandler,
  ListPublicStoriesQuery,
  ListPublicStoriesQueryHandler,
} from '../../../application';
import { ListPublicStoriesRequest } from '../requests';
import {
  type PublicChapterReaderResponse,
  type PublicStoryPageResponse,
  type PublicStoryResponse,
  toPublicChapterReaderResponse,
  toPublicStoryPageResponse,
  toPublicStoryResponse,
} from '../responses';

@Controller('stories')
@Public()
export class PublicStoriesController {
  constructor(
    private readonly listStories: ListPublicStoriesQueryHandler,
    private readonly getStoryDetail: GetPublicStoryDetailQueryHandler,
    private readonly getChapterReader: GetPublicChapterReaderQueryHandler,
  ) {}

  @Get()
  async list(
    @Query() request: ListPublicStoriesRequest,
  ): Promise<PublicStoryPageResponse> {
    const result = await this.listStories.execute(
      new ListPublicStoriesQuery(
        request.q,
        request.genre,
        request.status,
        request.sort,
        request.yearFrom,
        request.yearTo,
        request.page,
        request.pageSize,
      ),
    );

    return toPublicStoryPageResponse(result);
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

  @Get(':slug')
  async detail(@Param('slug') slug: string): Promise<PublicStoryResponse> {
    const result = await this.getStoryDetail.execute(
      new GetPublicStoryDetailQuery(slug),
    );

    return toPublicStoryResponse(result);
  }
}
