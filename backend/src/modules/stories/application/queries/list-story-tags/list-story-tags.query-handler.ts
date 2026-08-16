import { Inject, Injectable } from '@nestjs/common';

import type { StoryTagOptionDto } from '../../dto';
import { STORY_PERSISTENCE_PORT, type StoryPersistencePort } from '../../ports';
import { ListStoryTagsQuery } from './list-story-tags.query';

@Injectable()
export class ListStoryTagsQueryHandler {
  constructor(
    @Inject(STORY_PERSISTENCE_PORT)
    private readonly persistence: StoryPersistencePort,
  ) {}

  execute(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _query: ListStoryTagsQuery,
  ): Promise<readonly StoryTagOptionDto[]> {
    return this.persistence.listTags();
  }
}
