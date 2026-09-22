import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import { AuthorChapterMediaPage } from '../domain/author-story-management.models';
import { idempotencyHeaders } from './idempotency-http.util';

@Injectable({ providedIn: 'root' })
export class AuthorChapterMediaHttpService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);

  attach(
    storyId: string,
    chapterId: string,
    pages: ReadonlyArray<{ readonly mediaAssetId: string; readonly caption?: string }>,
  ): Observable<readonly AuthorChapterMediaPage[]> {
    return this.http
      .post<ApiSuccessEnvelope<readonly AuthorChapterMediaPage[]>>(
        `${this.url(storyId, chapterId)}/media`,
        { pages },
        { headers: idempotencyHeaders() },
      )
      .pipe(map((response) => response.data));
  }

  reorder(
    storyId: string,
    chapterId: string,
    orderedMediaAssetIds: readonly string[],
  ): Observable<readonly AuthorChapterMediaPage[]> {
    return this.http
      .put<ApiSuccessEnvelope<readonly AuthorChapterMediaPage[]>>(
        `${this.url(storyId, chapterId)}/media/order`,
        { orderedMediaAssetIds },
      )
      .pipe(map((response) => response.data));
  }

  remove(
    storyId: string,
    chapterId: string,
    mediaAssetId: string,
  ): Observable<readonly AuthorChapterMediaPage[]> {
    return this.http
      .delete<ApiSuccessEnvelope<readonly AuthorChapterMediaPage[]>>(
        `${this.url(storyId, chapterId)}/media/${mediaAssetId}`,
      )
      .pipe(map((response) => response.data));
  }

  private url(storyId: string, chapterId: string): string {
    return `${this.config.apiBaseUrl}/author/stories/${storyId}/chapters/${chapterId}`;
  }
}
