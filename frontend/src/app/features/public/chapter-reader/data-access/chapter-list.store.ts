import { inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, of, tap } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { ChapterListItem } from '../domain/chapter-reader.models';
import { ChapterReaderRepository } from './chapter-reader.repository';

@Injectable()
export class ChapterListStore {
  private readonly repository = inject(ChapterReaderRepository);
  private loadedForSlug: string | null = null;

  readonly open = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<readonly ChapterListItem[]>([]);
  readonly page = signal(1);
  readonly totalPages = signal(1);

  show(storySlug: string): void {
    this.open.set(true);
    if (this.loadedForSlug === storySlug) return;
    this.load(storySlug, 1);
  }

  close(): void {
    this.open.set(false);
  }

  goToPage(storySlug: string, page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.load(storySlug, page);
  }

  private load(storySlug: string, page: number): void {
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
}
