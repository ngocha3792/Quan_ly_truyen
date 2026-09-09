import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import {
  AuthorChapterDraftInput,
  AuthorManagedChapter,
} from '../domain/author-story-management.models';
import { type CreateRetryState, idempotencyHeaders, reuseCreateKey } from './idempotency-http.util';

@Injectable({ providedIn: 'root' })
export class AuthorChapterDraftHttpService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private createRetry: CreateRetryState | null = null;

  get(storyId: string, chapterId: string): Observable<AuthorManagedChapter> {
    return this.http
      .get<ApiSuccessEnvelope<AuthorManagedChapter>>(`${this.url(storyId)}/${chapterId}`)
      .pipe(map((response) => response.data));
  }
  create(storyId: string, input: AuthorChapterDraftInput): Observable<AuthorManagedChapter> {
    const retry = reuseCreateKey(this.createRetry, { storyId, input });
    this.createRetry = retry;
    return this.http
      .post<ApiSuccessEnvelope<AuthorManagedChapter>>(this.url(storyId), input, {
        headers: idempotencyHeaders(retry.key),
      })
      .pipe(
        map((response) => response.data),
        tap(() => {
          if (this.createRetry?.key === retry.key) this.createRetry = null;
        }),
      );
  }
  update(
    storyId: string,
    chapterId: string,
    input: AuthorChapterDraftInput,
  ): Observable<AuthorManagedChapter> {
    return this.http
      .patch<ApiSuccessEnvelope<AuthorManagedChapter>>(`${this.url(storyId)}/${chapterId}`, input)
      .pipe(map((response) => response.data));
  }
  autosave(
    storyId: string,
    chapterId: string,
    input: AuthorChapterDraftInput,
  ): Observable<AuthorManagedChapter> {
    return this.http
      .post<ApiSuccessEnvelope<AuthorManagedChapter>>(
        `${this.url(storyId)}/${chapterId}/autosave`,
        input,
      )
      .pipe(map((response) => response.data));
  }
  private url(storyId: string): string {
    return `${this.config.apiBaseUrl}/author/stories/${storyId}/chapters`;
  }
}
