import { inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, of, tap } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { StoryChapterListItem } from '../domain/story.models';
import { StoryDetailRepository } from './story.repository';

@Injectable()
export class StoryChapterListStore {
  private readonly repository = inject(StoryDetailRepository);
  private loadedForSlug: string | null = null;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<readonly StoryChapterListItem[]>([]);
  readonly page = signal(1);
  readonly totalPages = signal(1);

  load(storySlug: string, page = 1): void {
    if (page === 1 && this.loadedForSlug === storySlug) return;
    this.loading.set(true);
    this.error.set(null);
    this.repository
      .listChapters(storySlug, page, 100)
      .pipe(
        tap((result) => {
          this.items.set(result.items);
          this.page.set(result.page);
          this.totalPages.set(Math.max(1, result.totalPages));
          this.loadedForSlug = storySlug;
        }),
        catchError((error: unknown) => {
          this.error.set(getApiErrorMessage(error, 'Không thể tải danh sách chương.'));
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  goToPage(storySlug: string, page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.loadedForSlug = null;
    this.load(storySlug, page);
  }
}
