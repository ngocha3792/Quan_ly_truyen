import { inject, Injectable } from '@angular/core';
import { map, Observable, of, switchMap } from 'rxjs';

import { AuthStore } from '../../../../core/auth/auth.store';
import { PublicStoriesApiClient } from '../../../../core/http/public-stories-api.client';
import {
  PublicChapterNavigationApiItem,
  PublicChapterReaderApiResponse,
  PublicStoryChapterListApiItem,
} from '../../../../core/http/public-stories-api.model';
import { ReaderEngagementApiClient } from '../../../../core/http/reader-engagement-api.client';
import type {
  CommentReactionApiType,
  CommentReportReasonApi,
  StoryCommentApiItem,
} from '../../../../core/http/reader-engagement-api.model';
import {
  ChapterComment,
  ChapterListItem,
  ChapterListPage,
  ChapterNavigationItem,
  ChapterReaderView,
  TextSelectionAnchor,
  ComicCommentRegion,
} from '../domain/chapter-reader.models';
import { ChapterReaderRepository } from './chapter-reader.repository';
import { initials, relativeTime } from './chapter-comment-display';

@Injectable()
export class ChapterReaderHttpRepository implements ChapterReaderRepository {
  private readonly api = inject(PublicStoriesApiClient);
  private readonly engagement = inject(ReaderEngagementApiClient);
  private readonly auth = inject(AuthStore);

  getChapter(storySlug: string, chapterNumber: string): Observable<ChapterReaderView> {
    return this.api.chapter(storySlug, chapterNumber).pipe(map(toChapterReaderView));
  }

  unlockChapter(chapterId: string): Observable<void> {
    return this.api.unlockChapter(chapterId).pipe(map(() => undefined));
  }

  listChapters(storySlug: string, page: number, pageSize: number): Observable<ChapterListPage> {
    return this.api.chapters(storySlug, page, pageSize).pipe(
      map((result) => ({
        items: result.items.map((item) => toChapterListItem(storySlug, item)),
        page: result.pagination.page,
        totalPages: result.pagination.totalPages,
      })),
    );
  }

  getComments(
    storySlug: string,
    chapterNumber: string,
  ): Observable<{ readonly items: readonly ChapterComment[]; readonly total: number }> {
    return this.engagement
      .listChapterComments(storySlug, chapterNumber)
      .pipe(
        switchMap((page) =>
          this.withViewerReactions(page.items).pipe(
            map((items) => ({ items, total: page.pagination.totalItems })),
          ),
        ),
      );
  }

  createComment(storyId: string, chapterId: string, body: string): Observable<ChapterComment> {
    return this.engagement
      .createChapterComment(storyId, chapterId, body)
      .pipe(map((comment) => this.toChapterComment(comment)));
  }

  createAnchoredComment(
    storyId: string,
    chapterId: string,
    body: string,
    anchor: TextSelectionAnchor,
  ): Observable<ChapterComment> {
    return this.engagement
      .createAnchoredChapterComment(storyId, chapterId, body, anchor)
      .pipe(map((comment) => this.toChapterComment(comment)));
  }

  createComicRegionComment(
    storyId: string,
    chapterId: string,
    mediaAssetId: string,
    body: string,
    region: ComicCommentRegion,
  ): Observable<ChapterComment> {
    return this.engagement
      .createComicRegionComment(storyId, chapterId, mediaAssetId, body, region)
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

  getReplies(rootCommentId: string): Observable<readonly ChapterComment[]> {
    return this.engagement
      .listCommentReplies(rootCommentId)
      .pipe(switchMap((page) => this.withViewerReactions(page.items)));
  }

  createReply(parentCommentId: string, body: string): Observable<ChapterComment> {
    return this.engagement
      .createCommentReply(parentCommentId, body)
      .pipe(map((comment) => this.toChapterComment(comment)));
  }

  setReaction(commentId: string, type: CommentReactionApiType) {
    return this.engagement.setCommentReaction(commentId, type).pipe(
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

  saveProgress(storyId: string, chapterId: string): Observable<void> {
    return this.engagement.saveReadingProgress(storyId, chapterId).pipe(map(() => undefined));
  }

  getBookmark(chapterId: string): Observable<boolean> {
    return this.engagement.getReadingBookmark(chapterId).pipe(map((bookmark) => bookmark !== null));
  }

  saveBookmark(chapterId: string): Observable<void> {
    return this.engagement.upsertReadingBookmark(chapterId).pipe(map(() => undefined));
  }

  removeBookmark(chapterId: string): Observable<void> {
    return this.engagement.removeReadingBookmark(chapterId);
  }

  private withViewerReactions(
    items: readonly StoryCommentApiItem[],
  ): Observable<readonly ChapterComment[]> {
    if (!this.auth.isAuthenticated() || items.length === 0) {
      return of(items.map((comment) => this.toChapterComment(comment)));
    }
    return this.engagement
      .getViewerCommentReactions(items.map((item) => item.id))
      .pipe(
        map((mine) =>
          items.map((comment) => this.toChapterComment(comment, mine[comment.id] ?? null)),
        ),
      );
  }

  private toChapterComment(
    comment: StoryCommentApiItem,
    viewerReaction: CommentReactionApiType | null = null,
  ): ChapterComment {
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
      content: comment.body,
      createdAt: relativeTime(comment.createdAt),
      reactions: comment.reactions,
      viewerReaction,
      replyCount: comment.replyCount,
      threadReplyCount: comment.threadReplyCount,
      replies: [],
      isOwner: this.auth.user()?.id === comment.user.id,
      anchor: comment.anchor,
      region: comment.region,
    };
  }
}

function toChapterReaderView(result: PublicChapterReaderApiResponse): ChapterReaderView {
  const content =
    'previewContent' in result.chapter ? result.chapter.previewContent : result.chapter.content;
  const blocks =
    'contentDocument' in result.chapter && result.chapter.contentDocument
      ? result.chapter.contentDocument.blocks.map((block) => ({
          id: block.id,
          type: block.type,
          text: block.text,
        }))
      : toParagraphs(content).map((text) => ({
          id: null,
          type: 'paragraph' as const,
          text,
        }));
  return {
    story: result.story,
    chapter: {
      id: result.chapter.id,
      number: result.chapter.number,
      title: result.chapter.title,
      paragraphs: toParagraphs(content),
      blocks,
      publishedAt: result.chapter.publishedAt,
      views: result.chapter.views,
      accessState: result.chapter.access.state,
      priceCredits: result.chapter.access.priceCredits,
      unlockPolicy: result.chapter.access.unlockPolicy ?? 'PERMANENT_PAID',
      freeAt: result.chapter.access.freeAt ?? null,
      media:
        'media' in result.chapter && result.chapter.media
          ? result.chapter.media.map((media) => ({
              mediaAssetId: media.mediaAssetId,
              altText: media.altText,
              caption: media.caption,
              width: media.width,
              height: media.height,
              slices: media.slices,
            }))
          : [],
    },
    navigation: {
      previous: toNavigation(result.story.slug, result.navigation.previous),
      next: toNavigation(result.story.slug, result.navigation.next),
    },
    comments: [],
    totalComments: result.chapter.comments,
  };
}

function toChapterListItem(
  storySlug: string,
  item: PublicStoryChapterListApiItem,
): ChapterListItem {
  return {
    id: item.id,
    number: item.number,
    title: item.title,
    url: `/truyen/${storySlug}/chuong/${item.number}`,
    publishedAt: item.publishedAt,
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
