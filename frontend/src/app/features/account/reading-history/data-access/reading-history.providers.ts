import { Provider } from '@angular/core';

import { ReadingHistoryRepository } from '../domain/reading-history.repository';
import { ReadingHistoryMockRepository } from './reading-history-mock.repository';

export function provideReadingHistory(): Provider[] {
  return [
    {
      provide: ReadingHistoryRepository,
      useClass: ReadingHistoryMockRepository,
    },
  ];
}
