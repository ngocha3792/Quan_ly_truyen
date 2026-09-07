import { Inject, Injectable } from '@nestjs/common';

import type { WeeklyReadingStatsResultDto } from '../../dto';
import {
  READING_HISTORY_PERSISTENCE_PORT,
  type ReadingHistoryPersistencePort,
} from '../../ports';
import { requireReadingHistoryUserId } from '../../../domain/policies/reading-history-auth.policy';
import { GetWeeklyReadingStatsQuery } from './get-weekly-reading-stats.query';

@Injectable()
export class GetWeeklyReadingStatsQueryHandler {
  constructor(
    @Inject(READING_HISTORY_PERSISTENCE_PORT)
    private readonly persistence: ReadingHistoryPersistencePort,
  ) {}

  execute(
    query: GetWeeklyReadingStatsQuery,
  ): Promise<WeeklyReadingStatsResultDto> {
    return this.persistence.getWeeklyStats(
      requireReadingHistoryUserId(query.userId),
    );
  }
}
