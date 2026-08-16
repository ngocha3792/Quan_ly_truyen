import { inject, Injectable } from '@angular/core';
import { map, Observable, of, switchMap } from 'rxjs';

import { AuthStore } from '../../../../core/auth/auth.store';
import { PublicStoriesApiClient } from '../../../../core/http/public-stories-api.client';
import { PublicStoryApiItem } from '../../../../core/http/public-stories-api.model';
import { ReaderEngagementApiClient } from '../../../../core/http/reader-engagement-api.client';
import type {
  CommentReactionApiType,
  CommentReportReasonApi,
  StoryCommentApiItem,
} from '../../../../core/http/reader-engagement-api.model';
import { STORY_COVER_PLACEHOLDER } from '../../../../shared/models/story.model';
import { RelatedStoryItem, Story, StoryComment } from '../domain/story.models';
import { StoryDetailRepository } from './story.repository';

@Injectable()
export class StoryDetailHttpRepository implements StoryDetailRepository {
  private readonly api = inject(PublicStoriesApiClient);
  private readonly engagement = inject(ReaderEngagementApiClient);
  private readonly auth = inject(AuthStore);
  private categorySlugs: readonly string[] = [];
  private currentSlug = '';

  getStoryBySlug(slug: string): Observable<Story | null> {
    this.currentSlug = slug;
    return this.api.detail(slug).pipe(
      map((story) => {
        this.categorySlugs = story.categories.map((category) => category.slug);
        return toStory(story);
      }),
    );
  }

  getComments(storySlug: string): Observable<readonly StoryComment[]> {
    return this.engagement
      .listStoryComments(storySlug)
      .pipe(switchMap((page) => this.withViewerReactions(page.items)));
  }

  getRelatedStories(_categories: readonly string[]): Observable<readonly RelatedStoryItem[]> {
    const genre = this.categorySlugs[0];
    if (!genre) return of([]);
    return this.api.list({ genre, sort: 'popular', pageSize: 6 }).pipe(
      map((page) =>
        page.items
          .filter((story) => story.slug !== this.currentSlug)
          .slice(0, 5)
          .map((story) => ({
            title: story.title,
            slug: story.slug,
            coverUrl: story.coverUrl ?? STORY_COVER_PLACEHOLDER,
            latestChapter: story.latestChapter?.number ?? null,
          })),
      ),
    );
  }

  getMyRating(storyId: string): Observable<number | null> {
    return this.engagement.getMyRating(storyId).pipe(map((rating) => rating?.score ?? null));
  }

  setRating(storyId: string, score: number): Observable<number> {
    return this.engagement.upsertRating(storyId, score).pipe(map((rating) => rating.score));
  }

  clearRating(storyId: string): Observable<void> {
    return this.engagement.deleteRating(storyId);
  }

  createComment(storyId: string, body: string): Observable<StoryComment> {
    return this.engagement
      .createStoryComment(storyId, body)
      .pipe(map((item) => this.toComment(item)));
  }

  updateComment(commentId: string, body: string): Observable<StoryComment> {
    return this.engagement.updateComment(commentId, body).pipe(map((item) => this.toComment(item)));
  }

  deleteComment(commentId: string): Observable<void> {
    return this.engagement.deleteComment(commentId);
  }

  getReplies(rootCommentId: string): Observable<readonly StoryComment[]> {
    return this.engagement
      .listCommentReplies(rootCommentId)
      .pipe(switchMap((page) => this.withViewerReactions(page.items)));
  }

  createReply(parentCommentId: string, body: string): Observable<StoryComment> {
    return this.engagement
      .createCommentReply(parentCommentId, body)
      .pipe(map((item) => this.toComment(item)));
  }

  setReaction(commentId: string, type: CommentReactionApiType) {
    return this.engagement
      .setCommentReaction(commentId, type)
      .pipe(
        map((summary) => ({
          viewerReaction: summary.viewerReaction,
          reactions: summary.reactions,
        })),
      );
  }

  clearReaction(commentId: string): Observable<void> {
    return this.engagement.clearCommentReaction(commentId);
  }

  reportComment(
    commentId: string,
    reason: CommentReportReasonApi,
    description?: string,
  ): Observable<void> {
    return this.engagement.reportComment(commentId, reason, description).pipe(map(() => undefined));
  }

  private withViewerReactions(
    items: readonly StoryCommentApiItem[],
  ): Observable<readonly StoryComment[]> {
    const ids = items.map((item) => item.id);
    if (!this.auth.isAuthenticated() || ids.length === 0) {
      return of(items.map((item) => this.toComment(item)));
    }
    return this.engagement
      .getViewerCommentReactions(ids)
      .pipe(map((mine) => items.map((item) => this.toComment(item, mine[item.id] ?? null))));
  }

  private toComment(
    comment: StoryCommentApiItem,
    viewerReaction: CommentReactionApiType | null = null,
  ): StoryComment {
    return {
      id: comment.id,
      parentId: comment.parentId,
      depth: comment.depth,
      displayState: comment.displayState,
      author: {
        id: comment.user.id,
        name: comment.user.displayName,
        initials: initials(comment.user.displayName),
      },
      createdAt: relativeTime(comment.createdAt),
      content: comment.body,
      isOwner: this.auth.user()?.id === comment.user.id,
      reactions: comment.reactions,
      viewerReaction,
      replyCount: comment.replyCount,
      threadReplyCount: comment.threadReplyCount,
      replies: [],
    };
  }
}

function toStory(story: PublicStoryApiItem): Story {
  return {
    id: story.id,
    slug: story.slug,
    title: story.title,
    author: story.author.penName,
    description: story.synopsis,
    coverUrl: story.coverUrl ?? STORY_COVER_PLACEHOLDER,
    categories: story.categories.map((category) => category.name),
    latestChapter: story.latestChapter
      ? {
          number: story.latestChapter.number,
          title: story.latestChapter.title,
          slug: story.latestChapter.slug,
          updatedAt: story.latestChapter.publishedAt,
        }
      : null,
    views: story.stats.views,
    rating: story.stats.ratingAverage,
    chapterCount: story.stats.chapters,
    status: story.status,
    badge: story.status === 'COMPLETED' ? 'FULL' : undefined,
  };
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function relativeTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`;
  return `${Math.floor(minutes / 1440)} ngày trước`;
}
