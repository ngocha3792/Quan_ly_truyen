import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import { ApiSuccessEnvelope } from './api-envelope.model';
import {
  PublicChapterReaderApiResponse,
  PublicStoryApiItem,
  PublicStoryApiPage,
  PublicStoryListParams,
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

  chapter(storySlug: string, chapterNumber: string): Observable<PublicChapterReaderApiResponse> {
    return this.http
      .get<ApiSuccessEnvelope<PublicChapterReaderApiResponse>>(
        `${this.config.apiBaseUrl}/stories/${encodeURIComponent(storySlug)}/chapters/${encodeURIComponent(chapterNumber)}`,
      )
      .pipe(map((response) => response.data));
  }
}
