import { Inject, Injectable } from '@nestjs/common';

import { requireReadingHistoryUserId } from '../../../domain/policies/reading-history-auth.policy';
import type { ReadingHistoryEntryResultDto } from '../../dto';
import {
  READING_HISTORY_PERSISTENCE_PORT,
  type ReadingHistoryPersistencePort,
} from '../../ports';
import { GetReadingProgressQuery } from './get-reading-progress.query';

@Injectable()
export class GetReadingProgressQueryHandler {
  constructor(
    @Inject(READING_HISTORY_PERSISTENCE_PORT)
    private readonly persistence: ReadingHistoryPersistencePort,
  ) {}

  execute(
    query: GetReadingProgressQuery,
  ): Promise<ReadingHistoryEntryResultDto | null> {
    return this.persistence.getProgress(
      requireReadingHistoryUserId(query.userId),
      query.storyId,
    );
  }
}
