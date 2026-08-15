import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '@/common/decorators';
import {
  ListChapterCommentsQuery,
  ListChapterCommentsQueryHandler,
  ListStoryCommentsQuery,
  ListStoryCommentsQueryHandler,
  type StoryCommentPageResultDto,
} from '../../../application';
import { ListStoryCommentsRequest } from '../requests';

@Controller('stories')
@Public()
export class PublicStoryCommentsController {
  constructor(
    private readonly listStoryComments: ListStoryCommentsQueryHandler,
    private readonly listChapterComments: ListChapterCommentsQueryHandler,
  ) {}

  @Get(':storySlug/comments')
  listForStory(
    @Param('storySlug') storySlug: string,
    @Query() request: ListStoryCommentsRequest,
  ): Promise<StoryCommentPageResultDto> {
    return this.listStoryComments.execute(
      new ListStoryCommentsQuery(storySlug, request.page, request.pageSize),
    );
  }

  @Get(':storySlug/chapters/:chapterNumber/comments')
  listForChapter(
    @Param('storySlug') storySlug: string,
    @Param('chapterNumber') chapterNumber: string,
    @Query() request: ListStoryCommentsRequest,
  ): Promise<StoryCommentPageResultDto> {
    return this.listChapterComments.execute(
      new ListChapterCommentsQuery(storySlug, chapterNumber, request.page, request.pageSize),
    );
  }
}
