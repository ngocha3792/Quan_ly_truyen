import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import {
  AuthorChapterMonetization,
  MonetizationPriceBand,
} from '../domain/author-story-management.models';
import { idempotencyHeaders } from './idempotency-http.util';

@Injectable()
export class AuthorChapterMonetizationHttpService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly storiesUrl = `${this.config.apiBaseUrl}/author/stories`;

  listPriceBands(): Observable<readonly MonetizationPriceBand[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly MonetizationPriceBand[]>>(
        `${this.config.apiBaseUrl}/monetization/price-bands`,
      )
      .pipe(map((response) => response.data));
  }

  get(storyId: string, chapterId: string): Observable<AuthorChapterMonetization> {
    return this.http
      .get<ApiSuccessEnvelope<AuthorChapterMonetization>>(
        `${this.storiesUrl}/${storyId}/chapters/${chapterId}/monetization`,
      )
      .pipe(map((response) => response.data));
  }

  update(
    storyId: string,
    chapterId: string,
    input: { readonly accessType: 'FREE' | 'PAID'; readonly priceBandId?: string },
  ): Observable<AuthorChapterMonetization> {
    return this.http
      .put<ApiSuccessEnvelope<AuthorChapterMonetization>>(
        `${this.storiesUrl}/${storyId}/chapters/${chapterId}/monetization`,
        input,
        { headers: idempotencyHeaders() },
      )
      .pipe(map((response) => response.data));
  }
}
