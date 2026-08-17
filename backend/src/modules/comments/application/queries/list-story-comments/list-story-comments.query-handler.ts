import { Inject, Injectable } from '@nestjs/common';
import { CommentStoryNotFoundException } from '../../../domain';
import type { StoryCommentPageResultDto } from '../../dto';
import {
  COMMENT_PERSISTENCE_PORT,
  type CommentPersistencePort,
} from '../../ports';
import { ListStoryCommentsQuery } from './list-story-comments.query';

@Injectable()
export class ListStoryCommentsQueryHandler {
  constructor(
    @Inject(COMMENT_PERSISTENCE_PORT)
    private readonly persistence: CommentPersistencePort,
  ) {}

  async execute(
    query: ListStoryCommentsQuery,
  ): Promise<StoryCommentPageResultDto> {
    const result = await this.persistence.listComments({
      storySlug: query.storySlug.trim().toLowerCase(),
      page: query.page,
      pageSize: query.pageSize,
    });
    if (result.status !== 'found') {
      throw new CommentStoryNotFoundException(query.storySlug);
    }
    return result.page;
  }
}
