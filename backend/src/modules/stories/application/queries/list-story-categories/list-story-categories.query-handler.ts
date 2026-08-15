import { Inject, Injectable } from '@nestjs/common';

import type { StoryCategoryOptionDto } from '../../dto';
import {
  STORY_PERSISTENCE_PORT,
  type StoryPersistencePort,
} from '../../ports';
import { ListStoryCategoriesQuery } from './list-story-categories.query';

@Injectable()
export class ListStoryCategoriesQueryHandler {
  constructor(
    @Inject(STORY_PERSISTENCE_PORT)
    private readonly persistence: StoryPersistencePort,
  ) {}

  execute(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _query: ListStoryCategoriesQuery,
  ): Promise<readonly StoryCategoryOptionDto[]> {
    return this.persistence.listActiveCategories();
  }
}
