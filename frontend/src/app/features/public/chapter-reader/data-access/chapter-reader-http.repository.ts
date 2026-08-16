import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { AuthStore } from '../../../../core/auth/auth.store';
import { PublicStoriesApiClient } from '../../../../core/http/public-stories-api.client';
import {
  PublicChapterNavigationApiItem,
  PublicChapterReaderApiResponse,
} from '../../../../core/http/public-stories-api.model';
import { ReaderEngagementApiClient } from '../../../../core/http/reader-engagement-api.client';
import type { StoryCommentApiItem } from '../../../../core/http/reader-engagement-api.model';
import {
  ChapterComment,
  ChapterNavigationItem,
  ChapterReaderView,
} from '../domain/chapter-reader.models';
import { ChapterReaderRepository } from './chapter-reader.repository';

@Injectable()
export class ChapterReaderHttpRepository implements ChapterReaderRepository {
  private readonly api = inject(PublicStoriesApiClient);
  private readonly engagement = inject(ReaderEngagementApiClient);
  private readonly auth = inject(AuthStore);

  getChapter(storySlug: string, chapterNumber: string): Observable<ChapterReaderView> {
    return this.api.chapter(storySlug, chapterNumber).pipe(map(toChapterReaderView));
  }

  getComments(
    storySlug: string,
    chapterNumber: string,
  ): Observable<{ readonly items: readonly ChapterComment[]; readonly total: number }> {
    return this.engagement.listChapterComments(storySlug, chapterNumber).pipe(
      map((page) => ({
        items: page.items.map((comment) => this.toChapterComment(comment)),
        total: page.pagination.totalItems,
      })),
    );
  }

  createComment(storyId: string, chapterId: string, body: string): Observable<ChapterComment> {
    return this.engagement
      .createChapterComment(storyId, chapterId, body)
      .pipe(map((comment) => this.toChapterComment(comment)));
  }

  updateComment(commentId: string, body: string): Observable<ChapterComment> {
    return this.engagement
      .updateComment(commentId, body)
      .pipe(map((comment) => this.toChapterComment(comment)));
  }

  deleteComment(commentId: string): Observable<void> {
    return this.engagement.deleteComment(commentId);
  }

  saveProgress(storyId: string, chapterId: string): Observable<void> {
    return this.engagement.saveReadingProgress(storyId, chapterId).pipe(map(() => undefined));
  }

  private toChapterComment(comment: StoryCommentApiItem): ChapterComment {
    return {
      id: comment.id,
      author: {
        id: comment.user.id,
        name: comment.user.displayName,
        initials: initials(comment.user.displayName),
      },
      content: comment.body,
      createdAt: relativeTime(comment.createdAt),
      likes: comment.likeCount,
      isOwner: this.auth.user()?.id === comment.user.id,
    };
  }
}

function toChapterReaderView(result: PublicChapterReaderApiResponse): ChapterReaderView {
  return {
    story: result.story,
    chapter: {
      id: result.chapter.id,
      number: result.chapter.number,
      title: result.chapter.title,
      paragraphs: toParagraphs(result.chapter.content),
      publishedAt: result.chapter.publishedAt,
      views: result.chapter.views,
    },
    navigation: {
      previous: toNavigation(result.story.slug, result.navigation.previous),
      next: toNavigation(result.story.slug, result.navigation.next),
    },
    comments: [],
    totalComments: result.chapter.comments,
  };
}

function toNavigation(
  storySlug: string,
  chapter: PublicChapterNavigationApiItem | null,
): ChapterNavigationItem | null {
  if (!chapter) return null;
  return {
    number: chapter.number,
    title: chapter.title,
    url: `/truyen/${storySlug}/chuong/${chapter.number}`,
  };
}

function toParagraphs(content: string): readonly string[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  return normalized
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
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
