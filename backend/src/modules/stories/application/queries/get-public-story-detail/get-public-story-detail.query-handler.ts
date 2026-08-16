import { Inject, Injectable } from '@nestjs/common';

import type { PublicStoryDto } from '../../dto';
import { STORY_PERSISTENCE_PORT, type StoryPersistencePort } from '../../ports';
import { StoryNotFoundException } from '../../../domain';
import { GetPublicStoryDetailQuery } from './get-public-story-detail.query';

@Injectable()
export class GetPublicStoryDetailQueryHandler {
  constructor(
    @Inject(STORY_PERSISTENCE_PORT)
    private readonly persistence: StoryPersistencePort,
  ) {}

  async execute(query: GetPublicStoryDetailQuery): Promise<PublicStoryDto> {
    const slug = query.slug.trim().toLowerCase();
    const story = slug ? await this.persistence.findPublicBySlug(slug) : null;

    if (!story) {
      throw new StoryNotFoundException(slug || undefined);
    }

    return story;
  }
}
