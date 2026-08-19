import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, EMPTY, finalize, tap } from 'rxjs';

import {
  ReadingHistoryPeriod,
  ReadingHistorySort,
  ReadingHistorySyncState,
  ReadingHistoryView,
} from '../domain/reading-history.models';
import { ReadingHistoryRepository } from '../domain/reading-history.repository';

@Injectable()
export class ReadingHistoryStore {
  private readonly repository = inject(ReadingHistoryRepository);
  private readonly viewState = signal<ReadingHistoryView | null>(null);

  readonly view = this.viewState.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly query = signal('');
  readonly period = signal<ReadingHistoryPeriod>('all');
  readonly sort = signal<ReadingHistorySort>('recent');
  readonly bookmarkPendingChapterIds = signal<readonly string[]>([]);
  readonly syncState = signal<ReadingHistorySyncState>('idle');

  readonly filteredHistory = computed(() => {
    const view = this.viewState();
    if (!view) return [];
    const normalizedQuery = this.query().trim().toLocaleLowerCase('vi');
    const filtered = view.history.filter((item) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [item.title, item.author, item.chapterTitle, ...item.genres]
          .join(' ')
          .toLocaleLowerCase('vi')
          .includes(normalizedQuery);
      return matchesQuery && this.matchesSelectedPeriod(item.lastReadMinutes);
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
    this.fetchHistory(false);
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

  toggleBookmark(chapterId: string): void {
    const current = this.viewState();
    if (!current || this.bookmarkPendingChapterIds().includes(chapterId)) return;

    const item = current.history.find((candidate) => candidate.chapterId === chapterId);
    if (!item) return;

    const previous = item.bookmarked;
    this.setBookmarkState(chapterId, !previous);
    this.bookmarkPendingChapterIds.update((ids) => [...ids, chapterId]);

    const request$ = previous
      ? this.repository.removeBookmark(chapterId)
      : this.repository.saveBookmark(chapterId);

    request$
      .pipe(
        catchError(() => {
          this.setBookmarkState(chapterId, previous);
          this.error.set('Không thể cập nhật đánh dấu chương.');
          return EMPTY;
        }),
        finalize(() =>
          this.bookmarkPendingChapterIds.update((ids) =>
            ids.filter((id) => id !== chapterId),
          ),
        ),
      )
      .subscribe();
  }

  clearHistory(): void {
    this.error.set(null);
    this.repository
      .clearHistory()
      .pipe(
        tap(() => {
          const current = this.viewState();
          if (current) {
            this.viewState.set({
              ...current,
              history: [],
              continueReading: [],
              statistics: {
                ...current.statistics,
                storiesRead: '0',
                chaptersRead: '0',
              },
            });
          }
          this.bookmarkPendingChapterIds.set([]);
        }),
        catchError(() => {
          this.error.set('Không thể xóa lịch sử đọc.');
          return EMPTY;
        }),
      )
      .subscribe();
  }

  syncDevices(): void {
    this.fetchHistory(true);
  }

  private fetchHistory(markAsSync: boolean): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    if (markAsSync) this.syncState.set('syncing');

    this.repository
      .getHistory()
      .pipe(
        tap((view) => {
          this.viewState.set(view);
          if (markAsSync) this.syncState.set('success');
        }),
        catchError(() => {
          this.error.set('Không thể tải lịch sử đọc.');
          if (markAsSync) this.syncState.set('error');
          return EMPTY;
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }


  private setBookmarkState(chapterId: string, bookmarked: boolean): void {
    this.viewState.update((current) =>
      current
        ? {
            ...current,
            history: current.history.map((item) =>
              item.chapterId === chapterId ? { ...item, bookmarked } : item,
            ),
          }
        : current,
    );
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
