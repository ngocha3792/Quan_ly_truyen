import { Inject, Injectable } from '@nestjs/common';

import type { ReadingHistoryEntryResultDto } from '../../dto';
import {
  READING_HISTORY_PERSISTENCE_PORT,
  type ReadingHistoryPersistencePort,
} from '../../ports';
import { requireReadingHistoryUserId } from '../../../domain/policies/reading-history-auth.policy';
import { ListReadingHistoryQuery } from './list-reading-history.query';

@Injectable()
export class ListReadingHistoryQueryHandler {
  constructor(
    @Inject(READING_HISTORY_PERSISTENCE_PORT)
    private readonly persistence: ReadingHistoryPersistencePort,
  ) {}

  execute(
    query: ListReadingHistoryQuery,
  ): Promise<readonly ReadingHistoryEntryResultDto[]> {
    return this.persistence.listMine(requireReadingHistoryUserId(query.userId));
  }
}
