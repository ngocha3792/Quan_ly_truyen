import { inject, Injectable, signal } from '@angular/core';
import { catchError, EMPTY, finalize, of, switchMap, tap } from 'rxjs';
import { AuthStore } from '../../../../core/auth/auth.store';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { RelatedStoryItem, Story, StoryComment } from '../domain/story.models';
import { StoryDetailRepository } from './story.repository';

@Injectable()
export class StoryDetailStore {
  private readonly repository = inject(StoryDetailRepository);
  private readonly auth = inject(AuthStore);

  readonly story = signal<Story | null | undefined>(undefined);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly comments = signal<readonly StoryComment[]>([]);
  readonly relatedStories = signal<readonly RelatedStoryItem[]>([]);
  readonly ratingScore = signal<number | null>(null);
  readonly ratingPending = signal(false);
  readonly commentPending = signal(false);

  loadStory(slug: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.comments.set([]);
    this.ratingScore.set(null);

    this.repository.getStoryBySlug(slug).pipe(
      tap((story) => {
        this.story.set(story);
        this.loading.set(false);
      }),
      switchMap((story) => {
        if (!story) return of(null);
        this.repository.getComments(story.slug).pipe(
          tap((comments) => this.comments.set(comments)),
          catchError(() => of([])),
        ).subscribe();
        this.repository.getRelatedStories(story.categories).pipe(
          tap((related) => this.relatedStories.set(related)),
          catchError(() => of([])),
        ).subscribe();
        if (this.auth.isAuthenticated()) {
          this.repository.getMyRating(story.id).pipe(
            tap((score) => this.ratingScore.set(score)),
            catchError(() => of(null)),
          ).subscribe();
        }
        return of(story);
      }),
      catchError((err) => {
        this.loading.set(false);
        this.error.set(getApiErrorMessage(err, 'Không thể tải thông tin truyện.'));
        return of(null);
      }),
    ).subscribe();
  }

  setRating(score: number): void {
    const story = this.story();
    if (!story || this.ratingPending()) return;
    const previous = this.ratingScore();
    this.ratingScore.set(score);
    this.ratingPending.set(true);
    this.repository.setRating(story.id, score).pipe(
      tap((saved) => this.ratingScore.set(saved)),
      catchError(() => {
        this.ratingScore.set(previous);
        this.error.set('Không thể lưu đánh giá.');
        return EMPTY;
      }),
      finalize(() => this.ratingPending.set(false)),
    ).subscribe();
  }

  clearRating(): void {
    const story = this.story();
    if (!story || this.ratingPending()) return;
    const previous = this.ratingScore();
    this.ratingScore.set(null);
    this.ratingPending.set(true);
    this.repository.clearRating(story.id).pipe(
      catchError(() => {
        this.ratingScore.set(previous);
        this.error.set('Không thể xóa đánh giá.');
        return EMPTY;
      }),
      finalize(() => this.ratingPending.set(false)),
    ).subscribe();
  }

  addComment(body: string): void {
    const story = this.story();
    const normalized = body.trim();
    if (!story || !normalized || this.commentPending()) return;
    this.commentPending.set(true);
    this.repository.createComment(story.id, normalized).pipe(
      tap((comment) => this.comments.update((items) => [comment, ...items])),
      catchError(() => {
        this.error.set('Không thể gửi bình luận.');
        return EMPTY;
      }),
    ).subscribe({ complete: () => this.commentPending.set(false) });
  }

  editComment(commentId: string, body: string): void {
    const normalized = body.trim();
    if (!normalized) return;
    this.repository.updateComment(commentId, normalized).pipe(
      tap((updated) => this.comments.update((items) =>
        items.map((item) => item.id === commentId ? updated : item))),
      catchError(() => {
        this.error.set('Không thể sửa bình luận.');
        return EMPTY;
      }),
    ).subscribe();
  }

  deleteComment(commentId: string): void {
    this.repository.deleteComment(commentId).pipe(
      tap(() => this.comments.update((items) => items.filter((item) => item.id !== commentId))),
      catchError(() => {
        this.error.set('Không thể xóa bình luận.');
        return EMPTY;
      }),
    ).subscribe();
  }
}
