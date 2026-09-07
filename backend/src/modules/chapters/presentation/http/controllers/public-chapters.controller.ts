import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId, Public } from '@/common/decorators';
import { OptionalJwtAuthGuard } from '@/common/guards';
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
  @UseGuards(OptionalJwtAuthGuard)
  @Header('Cache-Control', 'private, no-store')
  async chapterReader(
    @CurrentUserId() viewerId: string | undefined,
    @Param('storySlug') storySlug: string,
    @Param('chapterNumber') chapterNumber: string,
  ): Promise<PublicChapterReaderResponse> {
    const result = await this.getChapterReader.execute(
      new GetPublicChapterReaderQuery(storySlug, chapterNumber, viewerId),
    );

    return toPublicChapterReaderResponse(result);
  }
}
