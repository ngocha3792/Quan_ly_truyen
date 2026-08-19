import { Inject, Injectable } from '@nestjs/common';

import { requireReadingHistoryUserId } from '../../../domain/policies/reading-history-auth.policy';
import type { ReadingBookmarkResultDto } from '../../dto';
import {
  READING_BOOKMARK_PERSISTENCE_PORT,
  type ReadingBookmarkPersistencePort,
} from '../../ports';
import { ListReadingBookmarksQuery } from './list-reading-bookmarks.query';

@Injectable()
export class ListReadingBookmarksQueryHandler {
  constructor(
    @Inject(READING_BOOKMARK_PERSISTENCE_PORT)
    private readonly persistence: ReadingBookmarkPersistencePort,
  ) {}

  execute(
    query: ListReadingBookmarksQuery,
  ): Promise<readonly ReadingBookmarkResultDto[]> {
    return this.persistence.listMine(requireReadingHistoryUserId(query.userId));
  }
}
