import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import {
  ChapterReviewItem,
  ChapterReviewPage,
  ReviewDecision,
} from '../domain/chapter-review.models';

@Injectable({ providedIn: 'root' })
export class ChapterReviewApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_RUNTIME_CONFIG).apiBaseUrl}/admin/chapter-reviews`;
  list(page: number) {
    return this.http
      .get<ApiSuccessEnvelope<ChapterReviewPage>>(this.base, { params: { page, pageSize: 20 } })
      .pipe(map((r) => r.data));
  }
  get(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<ChapterReviewItem>>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }
  review(id: string, expectedVersion: number, decision: ReviewDecision, comment: string) {
    return this.http.post(
      `${this.base}/${id}`,
      { expectedVersion, decision, ...(comment.trim() ? { comment: comment.trim() } : {}) },
      { headers: { 'x-idempotency-key': globalThis.crypto.randomUUID() } },
    );
  }
}
