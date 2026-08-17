import { inject, Injectable, signal } from '@angular/core';
import { catchError, EMPTY, finalize, map, Observable, of, switchMap, tap } from 'rxjs';
import { AuthStore } from '../../../../core/auth/auth.store';
import type {
  CommentReactionApiType,
  CommentReportReasonApi,
} from '../../../../core/http/reader-engagement-api.model';
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
  readonly commentMessage = signal<string | null>(null);

  loadStory(slug: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.comments.set([]);
    this.commentMessage.set(null);
    this.ratingScore.set(null);

    this.repository
      .getStoryBySlug(slug)
      .pipe(
        tap((story) => {
          this.story.set(story);
          this.loading.set(false);
        }),
        switchMap((story) => {
          if (!story) return of(null);
          this.auth
            .ensureInitialized()
            .pipe(
              switchMap((authState) =>
                this.repository.getComments(story.slug).pipe(
                  tap((comments) => this.comments.set(comments)),
                  switchMap(() =>
                    authState === 'authenticated'
                      ? this.repository.getMyRating(story.id).pipe(
                          tap((score) => this.ratingScore.set(score)),
                          catchError(() => of(null)),
                        )
                      : of(null),
                  ),
                  catchError(() => of(null)),
                ),
              ),
              catchError(() => of(null)),
            )
            .subscribe();
          this.repository
            .getRelatedStories(story.categories)
            .pipe(
              tap((related) => this.relatedStories.set(related)),
              catchError(() => of([])),
            )
            .subscribe();
          return of(story);
        }),
        catchError((err) => {
          this.loading.set(false);
          this.error.set(getApiErrorMessage(err, 'Không thể tải thông tin truyện.'));
          return of(null);
        }),
      )
      .subscribe();
  }

  setRating(score: number): void {
    const story = this.story();
    if (!story || this.ratingPending()) return;
    const previous = this.ratingScore();
    this.ratingScore.set(score);
    this.ratingPending.set(true);
    this.repository
      .setRating(story.id, score)
      .pipe(
        tap((saved) => this.ratingScore.set(saved)),
        catchError(() => {
          this.ratingScore.set(previous);
          this.error.set('Không thể lưu đánh giá.');
          return EMPTY;
        }),
        finalize(() => this.ratingPending.set(false)),
      )
      .subscribe();
  }

  clearRating(): void {
    const story = this.story();
    if (!story || this.ratingPending()) return;
    const previous = this.ratingScore();
    this.ratingScore.set(null);
    this.ratingPending.set(true);
    this.repository
      .clearRating(story.id)
      .pipe(
        catchError(() => {
          this.ratingScore.set(previous);
          this.error.set('Không thể xóa đánh giá.');
          return EMPTY;
        }),
        finalize(() => this.ratingPending.set(false)),
      )
      .subscribe();
  }

  addComment(body: string): void {
    const story = this.story();
    const normalized = body.trim();
    if (!story || !normalized || this.commentPending()) return;
    this.commentPending.set(true);
    this.repository
      .createComment(story.id, normalized)
      .pipe(
        tap((comment) => this.comments.update((items) => [comment, ...items])),
        catchError(() => {
          this.error.set('Không thể gửi bình luận.');
          return EMPTY;
        }),
      )
      .subscribe({ complete: () => this.commentPending.set(false) });
  }

  editComment(commentId: string, body: string): void {
    const normalized = body.trim();
    if (!normalized) return;
    this.repository
      .updateComment(commentId, normalized)
      .pipe(
        tap((updated) =>
          this.comments.update((items) => this.updateComment(items, commentId, () => updated)),
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
        switchMap(() => {
          const story = this.story();
          return story ? this.repository.getComments(story.slug) : of([]);
        }),
        tap((comments) => this.comments.set(comments)),
        catchError(() => {
          this.commentMessage.set('Không thể xóa bình luận.');
          return EMPTY;
        }),
      )
      .subscribe();
  }

  loadReplies(rootCommentId: string): void {
    this.repository
      .getReplies(rootCommentId)
      .pipe(
        tap((replies) =>
          this.comments.update((items) =>
            this.updateComment(items, rootCommentId, (comment) => ({ ...comment, replies })),
          ),
        ),
        catchError((error) => {
          this.commentMessage.set(getApiErrorMessage(error, 'Không thể tải phản hồi.'));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  reply(rootCommentId: string, parentCommentId: string, body: string): void {
    const normalized = body.trim();
    if (!normalized || this.commentPending()) return;
    this.commentPending.set(true);
    this.repository
      .createReply(parentCommentId, normalized)
      .pipe(
        tap((reply) =>
          this.comments.update((items) =>
            this.updateComment(items, rootCommentId, (root) => ({
              ...root,
              replies: [...root.replies, reply],
              threadReplyCount: root.threadReplyCount + 1,
            })),
          ),
        ),
        catchError((error) => {
          this.commentMessage.set(getApiErrorMessage(error, 'Không thể gửi phản hồi.'));
          return EMPTY;
        }),
        finalize(() => this.commentPending.set(false)),
      )
      .subscribe();
  }

  react(commentId: string, type: CommentReactionApiType): void {
    const current = this.findComment(this.comments(), commentId);
    if (!current || current.displayState !== 'VISIBLE') return;
    const snapshot = this.comments();
    const clearing = current.viewerReaction === type;
    this.comments.set(
      this.updateComment(snapshot, commentId, (comment) =>
        this.optimisticReaction(comment, clearing ? null : type),
      ),
    );
    const request$: Observable<{
      readonly viewerReaction: CommentReactionApiType | null;
      readonly reactions: Readonly<Record<CommentReactionApiType, number>>;
    } | null> = clearing
      ? this.repository.clearReaction(commentId).pipe(map(() => null))
      : this.repository.setReaction(commentId, type);
    request$
      .pipe(
        tap((summary) => {
          if (!summary) return;
          this.comments.update((items) =>
            this.updateComment(items, commentId, (comment) => ({
              ...comment,
              viewerReaction: summary.viewerReaction,
              reactions: summary.reactions,
            })),
          );
        }),
        catchError((error) => {
          this.comments.set(snapshot);
          this.commentMessage.set(getApiErrorMessage(error, 'Không thể cập nhật cảm xúc.'));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  report(commentId: string, reason: CommentReportReasonApi, description?: string): void {
    this.repository
      .reportComment(commentId, reason, description)
      .pipe(
        tap(() => this.commentMessage.set('Cảm ơn bạn đã báo cáo. Nhóm kiểm duyệt sẽ xem xét.')),
        catchError((error) => {
          this.commentMessage.set(getApiErrorMessage(error, 'Không thể gửi báo cáo.'));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  private optimisticReaction(
    comment: StoryComment,
    next: CommentReactionApiType | null,
  ): StoryComment {
    const counts = { ...comment.reactions };
    if (comment.viewerReaction)
      counts[comment.viewerReaction] = Math.max(0, counts[comment.viewerReaction] - 1);
    if (next) counts[next] = counts[next] + 1;
    return { ...comment, viewerReaction: next, reactions: counts };
  }

  private updateComment(
    items: readonly StoryComment[],
    id: string,
    update: (comment: StoryComment) => StoryComment,
  ): readonly StoryComment[] {
    return items.map((item) => {
      if (item.id === id) return update(item);
      if (item.replies.some((reply) => reply.id === id)) {
        return {
          ...item,
          replies: item.replies.map((reply) => (reply.id === id ? update(reply) : reply)),
        };
      }
      return item;
    });
  }

  private findComment(items: readonly StoryComment[], id: string): StoryComment | null {
    for (const item of items) {
      if (item.id === id) return item;
      const reply = item.replies.find((candidate) => candidate.id === id);
      if (reply) return reply;
    }
    return null;
  }
}
