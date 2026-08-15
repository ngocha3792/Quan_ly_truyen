import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, tap } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import { ApiSuccessEnvelope } from './api-envelope.model';
import {
  LibraryApiStatus,
  LibraryEntryApiItem,
  ReadingHistoryApiItem,
  StoryCommentApiItem,
  StoryCommentApiPage,
  StoryRatingApiItem,
} from './reader-engagement-api.model';

@Injectable({ providedIn: 'root' })
export class ReaderEngagementApiClient {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly commentRetryKeys = new Map<string, string>();

  listLibrary(): Observable<readonly LibraryEntryApiItem[]> {
    return this.get<readonly LibraryEntryApiItem[]>('/library');
  }

  upsertLibrary(
    storyId: string,
    input: { readonly status?: LibraryApiStatus; readonly isFavorite?: boolean } = {},
  ): Observable<LibraryEntryApiItem> {
    return this.put<LibraryEntryApiItem>(`/library/${encodeURIComponent(storyId)}`, input);
  }

  removeLibrary(storyId: string): Observable<void> {
    return this.http.delete<void>(`${this.config.apiBaseUrl}/library/${encodeURIComponent(storyId)}`);
  }

  listReadingHistory(): Observable<readonly ReadingHistoryApiItem[]> {
    return this.get<readonly ReadingHistoryApiItem[]>('/reading-history');
  }

  saveReadingProgress(
    storyId: string,
    chapterId: string,
    position = 0,
  ): Observable<ReadingHistoryApiItem> {
    return this.put<ReadingHistoryApiItem>(
      `/reading-progress/${encodeURIComponent(storyId)}`,
      { chapterId, position },
    );
  }

  removeReadingHistory(storyId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.config.apiBaseUrl}/reading-history/${encodeURIComponent(storyId)}`,
    );
  }

  clearReadingHistory(): Observable<void> {
    return this.http.delete<void>(`${this.config.apiBaseUrl}/reading-history`);
  }

  getMyRating(storyId: string): Observable<StoryRatingApiItem | null> {
    return this.get<StoryRatingApiItem | null>(
      `/stories/${encodeURIComponent(storyId)}/rating/me`,
    );
  }

  upsertRating(storyId: string, score: number): Observable<StoryRatingApiItem> {
    return this.put<StoryRatingApiItem>(
      `/stories/${encodeURIComponent(storyId)}/rating`,
      { score },
    );
  }

  deleteRating(storyId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.config.apiBaseUrl}/stories/${encodeURIComponent(storyId)}/rating`,
    );
  }

  listStoryComments(storySlug: string, page = 1, pageSize = 20): Observable<StoryCommentApiPage> {
    return this.listComments(
      `/stories/${encodeURIComponent(storySlug)}/comments`,
      page,
      pageSize,
    );
  }

  listChapterComments(
    storySlug: string,
    chapterNumber: string,
    page = 1,
    pageSize = 20,
  ): Observable<StoryCommentApiPage> {
    return this.listComments(
      `/stories/${encodeURIComponent(storySlug)}/chapters/${encodeURIComponent(chapterNumber)}/comments`,
      page,
      pageSize,
    );
  }

  createStoryComment(storyId: string, body: string): Observable<StoryCommentApiItem> {
    return this.postComment(`/stories/${encodeURIComponent(storyId)}/comments`, body);
  }

  createChapterComment(
    storyId: string,
    chapterId: string,
    body: string,
  ): Observable<StoryCommentApiItem> {
    return this.postComment(
      `/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}/comments`,
      body,
    );
  }

  updateComment(commentId: string, body: string): Observable<StoryCommentApiItem> {
    return this.http
      .patch<ApiSuccessEnvelope<StoryCommentApiItem>>(
        `${this.config.apiBaseUrl}/comments/${encodeURIComponent(commentId)}`,
        { body },
      )
      .pipe(map((response) => response.data));
  }

  deleteComment(commentId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.config.apiBaseUrl}/comments/${encodeURIComponent(commentId)}`,
    );
  }

  private get<T>(path: string): Observable<T> {
    return this.http
      .get<ApiSuccessEnvelope<T>>(`${this.config.apiBaseUrl}${path}`)
      .pipe(map((response) => response.data));
  }

  private put<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .put<ApiSuccessEnvelope<T>>(`${this.config.apiBaseUrl}${path}`, body)
      .pipe(map((response) => response.data));
  }

  private listComments(path: string, page: number, pageSize: number): Observable<StoryCommentApiPage> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http
      .get<ApiSuccessEnvelope<StoryCommentApiPage>>(`${this.config.apiBaseUrl}${path}`, { params })
      .pipe(map((response) => response.data));
  }

  private postComment(path: string, body: string): Observable<StoryCommentApiItem> {
    const normalizedBody = body.trim();
    const identity = JSON.stringify({ path, body: normalizedBody });
    const key = this.commentRetryKeys.get(identity) ?? crypto.randomUUID();
    this.commentRetryKeys.set(identity, key);

    return this.http
      .post<ApiSuccessEnvelope<StoryCommentApiItem>>(
        `${this.config.apiBaseUrl}${path}`,
        { body: normalizedBody },
        { headers: new HttpHeaders({ 'x-idempotency-key': key }) },
      )
      .pipe(
        map((response) => response.data),
        tap(() => {
          if (this.commentRetryKeys.get(identity) === key) {
            this.commentRetryKeys.delete(identity);
          }
        }),
      );
  }
}
