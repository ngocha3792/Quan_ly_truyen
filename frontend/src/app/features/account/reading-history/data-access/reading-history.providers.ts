import { Provider } from '@angular/core';
import { ReadingHistoryRepository } from '../domain/reading-history.repository';
import { ReadingHistoryHttpRepository } from './reading-history-http.repository';

export function provideReadingHistory(): Provider[] {
  return [{ provide: ReadingHistoryRepository, useClass: ReadingHistoryHttpRepository }];
}
