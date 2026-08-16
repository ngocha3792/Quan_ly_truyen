import { inject, Injectable, signal } from '@angular/core';
import { catchError, EMPTY, finalize, map, of, switchMap, tap } from 'rxjs';

import { AuthStore } from '../../../../core/auth/auth.store';
import type { CommentReactionApiType, CommentReportReasonApi } from '../../../../core/http/reader-engagement-api.model';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { ChapterComment, ChapterReaderView } from '../domain/chapter-reader.models';
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
  readonly commentMessage = signal<string | null>(null);

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
                  comments: this.updateComment(current.comments, commentId, () => updated),
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
    this.repository.deleteComment(commentId).pipe(
      switchMap(() => {
        const current = this.viewState();
        return current ? this.repository.getComments(current.story.slug, String(current.chapter.number)) : of({ items: [], total: 0 });
      }),
      tap((result) => this.viewState.update((current) => current ? { ...current, comments: result.items, totalComments: result.total } : current)),
      catchError((error) => {
        this.commentMessage.set(getApiErrorMessage(error, 'Không thể xóa bình luận.'));
        return EMPTY;
      }),
    ).subscribe();
  }

  loadReplies(rootCommentId: string): void {
    this.repository.getReplies(rootCommentId).pipe(
      tap((replies) => this.viewState.update((current) => current ? {
        ...current,
        comments: this.updateComment(current.comments, rootCommentId, (comment) => ({ ...comment, replies })),
      } : current)),
      catchError((error) => {
        this.commentMessage.set(getApiErrorMessage(error, 'Không thể tải phản hồi.'));
        return EMPTY;
      }),
    ).subscribe();
  }

  reply(rootCommentId: string, parentCommentId: string, body: string): void {
    const normalized = body.trim();
    if (!normalized || this.commentPending()) return;
    this.commentPending.set(true);
    this.repository.createReply(parentCommentId, normalized).pipe(
      tap((reply) => this.viewState.update((current) => current ? {
        ...current,
        comments: this.updateComment(current.comments, rootCommentId, (root) => ({
          ...root, replies: [...root.replies, reply], threadReplyCount: root.threadReplyCount + 1,
        })),
        totalComments: current.totalComments + 1,
      } : current)),
      catchError((error) => {
        this.commentMessage.set(getApiErrorMessage(error, 'Không thể gửi phản hồi.'));
        return EMPTY;
      }),
      finalize(() => this.commentPending.set(false)),
    ).subscribe();
  }

  react(commentId: string, type: CommentReactionApiType): void {
    const view = this.viewState();
    if (!view) return;
    const current = this.findComment(view.comments, commentId);
    if (!current || current.displayState !== 'VISIBLE') return;
    const snapshot = view.comments;
    const clearing = current.viewerReaction === type;
    this.viewState.update((state) => state ? { ...state, comments: this.updateComment(snapshot, commentId, (comment) => this.optimisticReaction(comment, clearing ? null : type)) } : state);
    const request = clearing ? this.repository.clearReaction(commentId).pipe(map(() => null)) : this.repository.setReaction(commentId, type);
    request.pipe(
      tap((summary) => {
        if (!summary) return;
        this.viewState.update((state) => state ? { ...state, comments: this.updateComment(state.comments, commentId, (comment) => ({ ...comment, viewerReaction: summary.viewerReaction, reactions: summary.reactions })) } : state);
      }),
      catchError((error) => {
        this.viewState.update((state) => state ? { ...state, comments: snapshot } : state);
        this.commentMessage.set(getApiErrorMessage(error, 'Không thể cập nhật cảm xúc.'));
        return EMPTY;
      }),
    ).subscribe();
  }

  report(commentId: string, reason: CommentReportReasonApi, description?: string): void {
    this.repository.reportComment(commentId, reason, description).pipe(
      tap(() => this.commentMessage.set('Cảm ơn bạn đã báo cáo. Nhóm kiểm duyệt sẽ xem xét.')),
      catchError((error) => {
        this.commentMessage.set(getApiErrorMessage(error, 'Không thể gửi báo cáo.'));
        return EMPTY;
      }),
    ).subscribe();
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

  private optimisticReaction(comment: ChapterComment, next: CommentReactionApiType | null): ChapterComment {
    const reactions = { ...comment.reactions };
    if (comment.viewerReaction) reactions[comment.viewerReaction] = Math.max(0, reactions[comment.viewerReaction] - 1);
    if (next) reactions[next] = reactions[next] + 1;
    return { ...comment, viewerReaction: next, reactions };
  }

  private updateComment(items: readonly ChapterComment[], id: string, update: (comment: ChapterComment) => ChapterComment): readonly ChapterComment[] {
    return items.map((item) => {
      if (item.id === id) return update(item);
      if (item.replies.some((reply) => reply.id === id)) {
        return { ...item, replies: item.replies.map((reply) => reply.id === id ? update(reply) : reply) };
      }
      return item;
    });
  }

  private findComment(items: readonly ChapterComment[], id: string): ChapterComment | null {
    for (const item of items) {
      if (item.id === id) return item;
      const reply = item.replies.find((candidate) => candidate.id === id);
      if (reply) return reply;
    }
    return null;
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
