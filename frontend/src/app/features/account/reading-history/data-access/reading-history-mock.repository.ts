import { Injectable } from '@angular/core';

import { ReadingHistoryView } from '../domain/reading-history.models';
import { ReadingHistoryRepository } from '../domain/reading-history.repository';
import { READING_HISTORY_MOCK } from '../mock/reading-history.mock';

@Injectable()
export class ReadingHistoryMockRepository implements ReadingHistoryRepository {
  getHistory(): ReadingHistoryView {
    return READING_HISTORY_MOCK;
  }
}
