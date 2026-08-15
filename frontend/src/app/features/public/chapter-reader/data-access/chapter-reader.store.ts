import { inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, of, tap } from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { ChapterReaderView } from '../domain/chapter-reader.models';
import { ChapterReaderRepository } from './chapter-reader.repository';

@Injectable()
export class ChapterReaderStore {
  private readonly repository = inject(ChapterReaderRepository);
  private readonly viewState = signal<ChapterReaderView | null>(null);

  readonly view = this.viewState.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly fontSize = signal(18);
  readonly lightsOff = signal(false);
  readonly bookmarked = signal(false);

  load(storySlug: string, chapterNumber: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.repository
      .getChapter(storySlug, chapterNumber)
      .pipe(
        tap((view) => this.viewState.set(view)),
        catchError((error: unknown) => {
          this.viewState.set(null);
          this.error.set(getApiErrorMessage(error, 'Không thể tải chương truyện.'));
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  decreaseFontSize(): void {
    this.fontSize.update((current) => Math.max(15, current - 1));
  }

  increaseFontSize(): void {
    this.fontSize.update((current) => Math.min(26, current + 1));
  }

  resetFontSize(): void {
    this.fontSize.set(18);
  }

  toggleLights(): void {
    this.lightsOff.update((current) => !current);
  }

  toggleBookmark(): void {
    this.bookmarked.update((current) => !current);
  }
}
