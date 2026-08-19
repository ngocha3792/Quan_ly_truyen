import { Observable } from 'rxjs';
import { ReadingHistoryView } from './reading-history.models';

export abstract class ReadingHistoryRepository {
  abstract getHistory(): Observable<ReadingHistoryView>;
  abstract clearHistory(): Observable<void>;
  abstract saveBookmark(chapterId: string): Observable<void>;
  abstract removeBookmark(chapterId: string): Observable<void>;
}
