import { Inject, Injectable } from '@nestjs/common';
import type { ReadingHistoryEntryResultDto } from '../../dto';
import {
  READER_ENGAGEMENT_PERSISTENCE_PORT,
  type ReaderEngagementPersistencePort,
} from '../../ports';
import { requireReaderUserId } from '../../reader-engagement.util';
import { ListReadingHistoryQuery } from './list-reading-history.query';

@Injectable()
export class ListReadingHistoryQueryHandler {
  constructor(
    @Inject(READER_ENGAGEMENT_PERSISTENCE_PORT)
    private readonly persistence: ReaderEngagementPersistencePort,
  ) {}

  execute(query: ListReadingHistoryQuery): Promise<readonly ReadingHistoryEntryResultDto[]> {
    return this.persistence.listReadingHistory(requireReaderUserId(query.userId));
  }
}
