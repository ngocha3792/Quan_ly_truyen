import { Inject, Injectable } from '@nestjs/common';
import { StoryNotFoundException } from '../../../domain';
import type { StoryCommentPageResultDto } from '../../dto';
import {
  READER_ENGAGEMENT_PERSISTENCE_PORT,
  type ReaderEngagementPersistencePort,
} from '../../ports';
import { ListStoryCommentsQuery } from './list-story-comments.query';

@Injectable()
export class ListStoryCommentsQueryHandler {
  constructor(
    @Inject(READER_ENGAGEMENT_PERSISTENCE_PORT)
    private readonly persistence: ReaderEngagementPersistencePort,
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
      throw new StoryNotFoundException(query.storySlug);
    }
    return result.page;
  }
}
