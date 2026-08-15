import { inject, Injectable, signal } from '@angular/core';
import { catchError, EMPTY, finalize, of, switchMap, tap } from 'rxjs';

import { AuthStore } from '../../../../core/auth/auth.store';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { ChapterReaderView } from '../domain/chapter-reader.models';
import { ChapterReaderRepository } from './chapter-reader.repository';

@Injectable()
export class ChapterReaderStore {
  private readonly repository = inject(ChapterReaderRepository);
  private readonly auth = inject(AuthStore);
  private readonly viewState = signal<ChapterReaderView | null>(null);

  readonly view = this.viewState.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly fontSize = signal(18);
  readonly lightsOff = signal(false);
  readonly bookmarked = signal(false);
  readonly commentPending = signal(false);

  load(storySlug: string, chapterNumber: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.repository
      .getChapter(storySlug, chapterNumber)
      .pipe(
        tap((view) => {
          this.viewState.set(view);
          this.auth
            .ensureInitialized()
            .pipe(
              tap(() => this.loadComments(storySlug, chapterNumber)),
              switchMap((result) =>
                result === 'authenticated'
                  ? this.repository.saveProgress(view.story.id, view.chapter.id)
                  : of(undefined),
              ),
              catchError(() => of(undefined)),
            )
            .subscribe();
        }),
        catchError((error: unknown) => {
          this.viewState.set(null);
          this.error.set(getApiErrorMessage(error, 'Không thể tải chương truyện.'));
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  addComment(body: string): void {
    const view = this.viewState();
    const normalized = body.trim();
    if (!view || !normalized || this.commentPending()) return;
    this.commentPending.set(true);
    this.repository
      .createComment(view.story.id, view.chapter.id, normalized)
      .pipe(
        tap((comment) =>
          this.viewState.update((current) =>
            current
              ? {
                  ...current,
                  comments: [comment, ...current.comments],
                  totalComments: current.totalComments + 1,
                }
              : current,
          ),
        ),
        catchError(() => {
          this.error.set('Không thể gửi bình luận.');
          return EMPTY;
        }),
        finalize(() => this.commentPending.set(false)),
      )
      .subscribe();
  }

  editComment(commentId: string, body: string): void {
    const normalized = body.trim();
    if (!normalized) return;
    this.repository
      .updateComment(commentId, normalized)
      .pipe(
        tap((updated) =>
          this.viewState.update((current) =>
            current
              ? {
                  ...current,
                  comments: current.comments.map((comment) =>
                    comment.id === commentId ? updated : comment,
                  ),
                }
              : current,
          ),
        ),
        catchError(() => {
          this.error.set('Không thể sửa bình luận.');
          return EMPTY;
        }),
      )
      .subscribe();
  }

  deleteComment(commentId: string): void {
    this.repository
      .deleteComment(commentId)
      .pipe(
        tap(() =>
          this.viewState.update((current) =>
            current
              ? {
                  ...current,
                  comments: current.comments.filter((comment) => comment.id !== commentId),
                  totalComments: Math.max(0, current.totalComments - 1),
                }
              : current,
          ),
        ),
        catchError(() => {
          this.error.set('Không thể xóa bình luận.');
          return EMPTY;
        }),
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

  private loadComments(storySlug: string, chapterNumber: string): void {
    this.repository
      .getComments(storySlug, chapterNumber)
      .pipe(
        tap((result) =>
          this.viewState.update((current) =>
            current
              ? {
                  ...current,
                  comments: result.items,
                  totalComments: result.total,
                }
              : current,
          ),
        ),
        catchError(() => of([])),
      )
      .subscribe();
  }
}
