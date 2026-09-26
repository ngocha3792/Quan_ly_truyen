import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import {
  AuthorManagedChapter,
  BulkChapterActionResult,
} from '../domain/author-story-management.models';
import { idempotencyHeaders } from './idempotency-http.util';

@Injectable({ providedIn: 'root' })
export class AuthorChapterPublicationHttpService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);

  publish(storyId: string, chapterId: string): Observable<AuthorManagedChapter> {
    return this.http
      .post<ApiSuccessEnvelope<AuthorManagedChapter>>(
        `${this.url(storyId, chapterId)}/publish`,
        {},
        { headers: idempotencyHeaders() },
      )
      .pipe(map((response) => response.data));
  }

  /** Gửi duyệt hết bản nháp của truyện. */
  submitAll(storyId: string): Observable<BulkChapterActionResult> {
    return this.http
      .post<ApiSuccessEnvelope<BulkChapterActionResult>>(
        `${this.storyUrl(storyId)}/submit-all`,
        {},
        { headers: idempotencyHeaders() },
      )
      .pipe(map((response) => response.data));
  }

  /** Xuất bản hết chương đã duyệt của truyện. */
  publishAll(storyId: string): Observable<BulkChapterActionResult> {
    return this.http
      .post<ApiSuccessEnvelope<BulkChapterActionResult>>(
        `${this.storyUrl(storyId)}/publish-all`,
        {},
        { headers: idempotencyHeaders() },
      )
      .pipe(map((response) => response.data));
  }

  schedule(
    storyId: string,
    chapterId: string,
    scheduledAt: string,
  ): Observable<AuthorManagedChapter> {
    return this.http
      .put<ApiSuccessEnvelope<AuthorManagedChapter>>(`${this.url(storyId, chapterId)}/schedule`, {
        scheduledAt,
      })
      .pipe(map((response) => response.data));
  }

  cancel(storyId: string, chapterId: string): Observable<AuthorManagedChapter> {
    return this.http
      .delete<ApiSuccessEnvelope<AuthorManagedChapter>>(`${this.url(storyId, chapterId)}/schedule`)
      .pipe(map((response) => response.data));
  }

  private url(storyId: string, chapterId: string): string {
    return `${this.storyUrl(storyId)}/${chapterId}`;
  }

  private storyUrl(storyId: string): string {
    return `${this.config.apiBaseUrl}/author/stories/${storyId}/chapters`;
  }
}
