import { Inject, Injectable } from '@nestjs/common';

import type { PublicStoryChapterListDto } from '../../dto';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import { ChapterStoryNotFoundException } from '../../../domain';
import { ListPublicStoryChaptersQuery } from './list-public-story-chapters.query';

@Injectable()
export class ListPublicStoryChaptersQueryHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) {}

  async execute(
    query: ListPublicStoryChaptersQuery,
  ): Promise<PublicStoryChapterListDto> {
    const storySlug = query.storySlug.trim().toLowerCase();

    if (!storySlug) {
      throw new ChapterStoryNotFoundException();
    }

    const result = await this.persistence.listPublishedByStory(
      storySlug,
      query.page,
      query.pageSize,
    );

    if (!result) {
      throw new ChapterStoryNotFoundException();
    }

    return result;
  }
}
