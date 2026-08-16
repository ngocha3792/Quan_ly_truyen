import { Inject, Injectable } from '@nestjs/common';
import {
  ChapterNotFoundException,
  StoryNotFoundException,
} from '../../../domain';
import type { StoryCommentPageResultDto } from '../../dto';
import {
  READER_ENGAGEMENT_PERSISTENCE_PORT,
  type ReaderEngagementPersistencePort,
} from '../../ports';
import { ListChapterCommentsQuery } from './list-chapter-comments.query';

@Injectable()
export class ListChapterCommentsQueryHandler {
  constructor(
    @Inject(READER_ENGAGEMENT_PERSISTENCE_PORT)
    private readonly persistence: ReaderEngagementPersistencePort,
  ) {}

  async execute(
    query: ListChapterCommentsQuery,
  ): Promise<StoryCommentPageResultDto> {
    const result = await this.persistence.listComments({
      storySlug: query.storySlug.trim().toLowerCase(),
      chapterNumber: query.chapterNumber.trim(),
      page: query.page,
      pageSize: query.pageSize,
    });
    if (result.status === 'story_not_found') {
      throw new StoryNotFoundException(query.storySlug);
    }
    if (result.status === 'chapter_not_found') {
      throw new ChapterNotFoundException(query.chapterNumber);
    }
    return result.page;
  }
}
