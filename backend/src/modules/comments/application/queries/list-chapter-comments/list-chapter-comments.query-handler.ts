import { Inject, Injectable } from '@nestjs/common';
import {
  CommentChapterNotFoundException,
  CommentStoryNotFoundException,
} from '../../../domain';
import type { StoryCommentPageResultDto } from '../../dto';
import {
  COMMENT_PERSISTENCE_PORT,
  type CommentPersistencePort,
} from '../../ports';
import { ListChapterCommentsQuery } from './list-chapter-comments.query';

@Injectable()
export class ListChapterCommentsQueryHandler {
  constructor(
    @Inject(COMMENT_PERSISTENCE_PORT)
    private readonly persistence: CommentPersistencePort,
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
      throw new CommentStoryNotFoundException(query.storySlug);
    }
    if (result.status === 'chapter_not_found') {
      throw new CommentChapterNotFoundException(query.chapterNumber);
    }
    return result.page;
  }
}
