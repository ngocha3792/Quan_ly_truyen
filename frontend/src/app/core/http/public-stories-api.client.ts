import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import { ApiSuccessEnvelope } from './api-envelope.model';
import {
  PublicChapterReaderApiResponse,
  PublicStoryApiItem,
  PublicStoryApiPage,
  PublicStoryChapterListApiResponse,
  PublicStoryListParams,
  RecommendationPreferencesApi,
  StoryRecommendationFeedApi,
  TrackRecommendationImpressionApiRequest,
  UnlockChapterApiResponse,
} from './public-stories-api.model';

@Injectable({ providedIn: 'root' })
export class PublicStoriesApiClient {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);

  list(params: PublicStoryListParams = {}): Observable<PublicStoryApiPage> {
    let httpParams = new HttpParams();

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }

    return this.http
      .get<ApiSuccessEnvelope<PublicStoryApiPage>>(`${this.config.apiBaseUrl}/stories`, {
        params: httpParams,
      })
      .pipe(map((response) => response.data));
  }

  detail(slug: string): Observable<PublicStoryApiItem> {
    return this.http
      .get<ApiSuccessEnvelope<PublicStoryApiItem>>(
        `${this.config.apiBaseUrl}/stories/${encodeURIComponent(slug)}`,
      )
      .pipe(map((response) => response.data));
  }

  recommendations(limit = 8): Observable<StoryRecommendationFeedApi> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http
      .get<ApiSuccessEnvelope<StoryRecommendationFeedApi>>(
        `${this.config.apiBaseUrl}/recommendations/stories`,
        { params },
      )
      .pipe(map((response) => response.data));
  }

  recommendationPreferences(): Observable<RecommendationPreferencesApi> {
    return this.http
      .get<ApiSuccessEnvelope<RecommendationPreferencesApi>>(
        `${this.config.apiBaseUrl}/recommendations/preferences`,
      )
      .pipe(map((response) => response.data));
  }

  updateRecommendationPreferences(
    request: RecommendationPreferencesApi,
  ): Observable<RecommendationPreferencesApi> {
    return this.http
      .patch<ApiSuccessEnvelope<RecommendationPreferencesApi>>(
        `${this.config.apiBaseUrl}/recommendations/preferences`,
        request,
      )
      .pipe(map((response) => response.data));
  }

  trackRecommendationImpression(
    request: TrackRecommendationImpressionApiRequest,
  ): Observable<void> {
    return this.http
      .post<ApiSuccessEnvelope<null>>(
        `${this.config.apiBaseUrl}/recommendations/impressions`,
        request,
      )
      .pipe(map(() => undefined));
  }

  chapter(storySlug: string, chapterNumber: string): Observable<PublicChapterReaderApiResponse> {
    return this.http
      .get<ApiSuccessEnvelope<PublicChapterReaderApiResponse>>(
        `${this.config.apiBaseUrl}/stories/${encodeURIComponent(storySlug)}/chapters/${encodeURIComponent(chapterNumber)}`,
      )
      .pipe(map((response) => response.data));
  }

  unlockChapter(chapterId: string): Observable<UnlockChapterApiResponse> {
    return this.http
      .post<ApiSuccessEnvelope<UnlockChapterApiResponse>>(
        `${this.config.apiBaseUrl}/monetization/chapters/${encodeURIComponent(chapterId)}/unlock`,
        {},
        { headers: new HttpHeaders({ 'x-idempotency-key': crypto.randomUUID() }) },
      )
      .pipe(map((response) => response.data));
  }

  chapters(
    storySlug: string,
    page = 1,
    pageSize = 100,
  ): Observable<PublicStoryChapterListApiResponse> {
    const params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));

    return this.http
      .get<ApiSuccessEnvelope<PublicStoryChapterListApiResponse>>(
        `${this.config.apiBaseUrl}/stories/${encodeURIComponent(storySlug)}/chapters`,
        { params },
      )
      .pipe(map((response) => response.data));
  }
}
