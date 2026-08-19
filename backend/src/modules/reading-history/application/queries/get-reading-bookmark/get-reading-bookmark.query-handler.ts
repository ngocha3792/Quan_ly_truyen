import { Inject, Injectable } from '@nestjs/common';

import { requireReadingHistoryUserId } from '../../../domain/policies/reading-history-auth.policy';
import type { ReadingBookmarkResultDto } from '../../dto';
import {
  READING_BOOKMARK_PERSISTENCE_PORT,
  type ReadingBookmarkPersistencePort,
} from '../../ports';
import { GetReadingBookmarkQuery } from './get-reading-bookmark.query';

@Injectable()
export class GetReadingBookmarkQueryHandler {
  constructor(
    @Inject(READING_BOOKMARK_PERSISTENCE_PORT)
    private readonly persistence: ReadingBookmarkPersistencePort,
  ) {}

  execute(
    query: GetReadingBookmarkQuery,
  ): Promise<ReadingBookmarkResultDto | null> {
    return this.persistence.getMineByChapter(
      requireReadingHistoryUserId(query.userId),
      query.chapterId,
    );
  }
}
