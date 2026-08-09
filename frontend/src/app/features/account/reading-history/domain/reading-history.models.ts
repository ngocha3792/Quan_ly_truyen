export type ReadingHistoryPeriod = 'all' | 'today' | '7-days' | '30-days';

export type ReadingHistorySort = 'recent' | 'progress' | 'title';

export type ReadingHistorySyncState = 'idle' | 'success';

export type StoryCoverTone = 'blue' | 'orange' | 'silver' | 'violet' | 'gold' | 'cyan';

export interface ReadingHistoryItem {
  readonly id: string;
  readonly storySlug: string;
  readonly title: string;
  readonly author: string;
  readonly genres: readonly string[];

  readonly chapterNumber: number;
  readonly chapterTitle: string;

  readonly progress: number;
  readonly lastReadLabel: string;
  readonly lastReadMinutes: number;

  readonly coverInitials: string;
  readonly coverTone: StoryCoverTone;
}

export interface ReadingHistoryStatistics {
  readonly storiesRead: string;
  readonly chaptersRead: string;
  readonly weeklyReadingTime: string;
  readonly followedStories: string;
}

export interface ContinueReadingItem {
  readonly id: string;
  readonly storySlug: string;
  readonly title: string;
  readonly chapterNumber: number;
  readonly progress: number;
  readonly coverInitials: string;
  readonly coverTone: StoryCoverTone;
}

export interface ReadingHistoryView {
  readonly history: readonly ReadingHistoryItem[];
  readonly statistics: ReadingHistoryStatistics;
  readonly continueReading: readonly ContinueReadingItem[];
}
