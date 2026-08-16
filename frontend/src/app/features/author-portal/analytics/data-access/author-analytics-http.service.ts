import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import {
  AuthorAnalyticsOverview,
  StoryAnalyticsDetail,
  StoryAnalyticsList,
} from '../domain/author-analytics.models';

@Injectable({ providedIn: 'root' })
export class AuthorAnalyticsHttpService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);

  overview(from: string, to: string): Observable<AuthorAnalyticsOverview> {
    return this.http
      .get<ApiSuccessEnvelope<AuthorAnalyticsOverview>>(
        `${this.config.apiBaseUrl}/author/analytics/overview`,
        {
          params: new HttpParams().set('from', from).set('to', to),
        },
      )
      .pipe(map((response) => response.data));
  }

  stories(from: string, to: string, page = 1, pageSize = 20): Observable<StoryAnalyticsList> {
    return this.http
      .get<ApiSuccessEnvelope<StoryAnalyticsList>>(
        `${this.config.apiBaseUrl}/author/analytics/stories`,
        {
          params: new HttpParams()
            .set('from', from)
            .set('to', to)
            .set('page', page)
            .set('pageSize', pageSize),
        },
      )
      .pipe(map((response) => response.data));
  }

  story(storyId: string, from: string, to: string): Observable<StoryAnalyticsDetail> {
    return this.http
      .get<ApiSuccessEnvelope<StoryAnalyticsDetail>>(
        `${this.config.apiBaseUrl}/author/analytics/stories/${encodeURIComponent(storyId)}`,
        { params: new HttpParams().set('from', from).set('to', to) },
      )
      .pipe(map((response) => response.data));
  }
}
