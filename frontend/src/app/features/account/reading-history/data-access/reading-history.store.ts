import { computed, inject, Injectable, signal } from '@angular/core';

import {
  ReadingHistoryPeriod,
  ReadingHistorySort,
  ReadingHistoryView,
} from '../domain/reading-history.models';
import { ReadingHistoryRepository } from '../domain/reading-history.repository';

export type ReadingHistorySyncState = 'idle' | 'success';

@Injectable()
export class ReadingHistoryStore {
  private readonly repository = inject(ReadingHistoryRepository);

  private readonly viewState = signal<ReadingHistoryView | null>(null);

  readonly view = this.viewState.asReadonly();

  readonly query = signal('');
  readonly period = signal<ReadingHistoryPeriod>('all');

  readonly sort = signal<ReadingHistorySort>('recent');

  readonly bookmarkedIds = signal<readonly string[]>([]);

  readonly syncState = signal<ReadingHistorySyncState>('idle');

  readonly filteredHistory = computed(() => {
    const view = this.viewState();

    if (!view) {
      return [];
    }

    const normalizedQuery = this.query().trim().toLocaleLowerCase('vi');

    const filtered = view.history.filter((item) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [item.title, item.author, item.chapterTitle, ...item.genres]
          .join(' ')
          .toLocaleLowerCase('vi')
          .includes(normalizedQuery);

      const matchesPeriod = this.matchesSelectedPeriod(item.lastReadMinutes);

      return matchesQuery && matchesPeriod;
    });

    return [...filtered].sort((first, second) => {
      switch (this.sort()) {
        case 'progress':
          return second.progress - first.progress;

        case 'title':
          return first.title.localeCompare(second.title, 'vi');

        case 'recent':
        default:
          return first.lastReadMinutes - second.lastReadMinutes;
      }
    });
  });

  readonly resultCount = computed(() => this.filteredHistory().length);

  load(): void {
    this.viewState.set(this.repository.getHistory());
  }

  setQuery(query: string): void {
    this.query.set(query);
  }

  setPeriod(period: ReadingHistoryPeriod): void {
    this.period.set(period);
  }

  setSort(sort: ReadingHistorySort): void {
    this.sort.set(sort);
  }

  toggleBookmark(historyId: string): void {
    this.bookmarkedIds.update((currentIds) => {
      if (currentIds.includes(historyId)) {
        return currentIds.filter((id) => id !== historyId);
      }

      return [...currentIds, historyId];
    });
  }

  clearHistory(): void {
    const currentView = this.viewState();

    if (!currentView) {
      return;
    }

    this.viewState.set({
      ...currentView,

      history: [],
      continueReading: [],

      statistics: {
        ...currentView.statistics,
        storiesRead: '0',
        chaptersRead: '0',
        weeklyReadingTime: '0 phút',
      },
    });

    this.bookmarkedIds.set([]);
  }

  syncDevices(): void {
    this.syncState.set('success');
  }

  private matchesSelectedPeriod(lastReadMinutes: number): boolean {
    switch (this.period()) {
      case 'today':
        return lastReadMinutes <= 1_440;

      case '7-days':
        return lastReadMinutes <= 10_080;

      case '30-days':
        return lastReadMinutes <= 43_200;

      case 'all':
      default:
        return true;
    }
  }
}
