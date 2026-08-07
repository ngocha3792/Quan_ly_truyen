
import { ReadingHistoryView } from './reading-history.models';

export abstract class ReadingHistoryRepository {
    abstract getHistory(): ReadingHistoryView;
}