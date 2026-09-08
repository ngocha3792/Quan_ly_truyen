import { DestroyRef, inject, Injectable, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, map, of, switchMap, tap } from 'rxjs';

import { AuthStore } from '../../../../core/auth/auth.store';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { ChapterReaderView } from '../domain/chapter-reader.models';
import { ChapterReaderRepository } from './chapter-reader.repository';
import { ChapterReaderSourceService } from './chapter-reader-source.service';
import { ReadingProgressSyncService } from './reading-progress-sync.service';

interface ChapterReaderLoadTarget {
  readonly view: WritableSignal<ChapterReaderView | null>;
  readonly loading: WritableSignal<boolean>;
  readonly error: WritableSignal<string | null>;
  readonly bookmarked: WritableSignal<boolean>;
}

@Injectable()
export class ChapterReaderLoadCoordinator {
  private readonly repository = inject(ChapterReaderRepository);
  private readonly source = inject(ChapterReaderSourceService);
  private readonly auth = inject(AuthStore);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly progress = inject(ReadingProgressSyncService);
  private readonly destroyRef = inject(DestroyRef);
  private target: ChapterReaderLoadTarget | null = null;

  constructor() {
    this.source.invalidated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.invalidateOfflineView());
  }

  load(storySlug: string, chapterNumber: string, target: ChapterReaderLoadTarget): void {
    this.target = target;
    this.progress.flush();
    target.loading.set(true);
    target.error.set(null);
    target.bookmarked.set(false);
    this.source
      .getChapter(storySlug, chapterNumber)
      .pipe(
        tap((view) => this.acceptView(view, storySlug, chapterNumber, target)),
        catchError((error: unknown) => {
          target.view.set(null);
          target.error.set(getApiErrorMessage(error, 'Không thể tải chương truyện.'));
          return of(null);
        }),
        finalize(() => target.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private acceptView(
    view: ChapterReaderView,
    storySlug: string,
    chapterNumber: string,
    target: ChapterReaderLoadTarget,
  ): void {
    target.view.set(view);
    if (this.source.offlineMode()) {
      this.progress.start(view, true);
      return;
    }

    this.auth
      .ensureInitialized()
      .pipe(
        tap(() => this.loadComments(storySlug, chapterNumber, target.view)),
        switchMap((result) => {
          if (result !== 'authenticated' || view.chapter.accessState === 'LOCKED') {
            target.bookmarked.set(false);
            return of(undefined);
          }
          return forkJoin({
            progress: this.config.features.realtimeProgressSyncEnabled
              ? of(this.progress.start(view))
              : this.repository
                  .saveProgress(view.story.id, view.chapter.id)
                  .pipe(catchError(() => of(undefined))),
            bookmarked: this.repository
              .getBookmark(view.chapter.id)
              .pipe(catchError(() => of(false))),
          }).pipe(
            tap(({ bookmarked }) => target.bookmarked.set(bookmarked)),
            map(() => undefined),
          );
        }),
        catchError(() => of(undefined)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private loadComments(
    storySlug: string,
    chapterNumber: string,
    viewState: WritableSignal<ChapterReaderView | null>,
  ): void {
    this.repository
      .getComments(storySlug, chapterNumber)
      .pipe(
        tap((result) =>
          viewState.update((current) =>
            current ? { ...current, comments: result.items, totalComments: result.total } : current,
          ),
        ),
        catchError(() => of([])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private invalidateOfflineView(): void {
    if (!this.target) return;
    this.progress.stop();
    this.target.view.set(null);
    this.target.bookmarked.set(false);
    this.target.loading.set(false);
    this.target.error.set(
      'Bản offline đã được đóng vì phiên đăng nhập bị thu hồi hoặc tài khoản đã thay đổi.',
    );
  }
}
