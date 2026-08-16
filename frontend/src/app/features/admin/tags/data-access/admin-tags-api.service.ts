import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import { AdminTag, AdminTagList, AdminTagMergeResult } from '../domain/admin-tag.models';

@Injectable({ providedIn: 'root' })
export class AdminTagsApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly url = `${this.config.apiBaseUrl}/admin/tags`;

  list(
    input: { q?: string; page?: number; pageSize?: number; sort?: string } = {},
  ): Observable<AdminTagList> {
    let params = new HttpParams()
      .set('page', input.page ?? 1)
      .set('pageSize', input.pageSize ?? 20)
      .set('sort', input.sort ?? 'name:asc');
    if (input.q) params = params.set('q', input.q);
    return this.http
      .get<ApiSuccessEnvelope<AdminTagList>>(this.url, { params })
      .pipe(map((response) => response.data));
  }

  create(name: string): Observable<AdminTag> {
    return this.http
      .post<ApiSuccessEnvelope<AdminTag>>(this.url, { name })
      .pipe(map((response) => response.data));
  }

  update(tagId: string, name: string): Observable<AdminTag> {
    return this.http
      .patch<ApiSuccessEnvelope<AdminTag>>(`${this.url}/${tagId}`, { name })
      .pipe(map((response) => response.data));
  }

  delete(tagId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${tagId}`);
  }

  merge(sourceTagId: string, targetTagId: string): Observable<AdminTagMergeResult> {
    return this.http
      .post<ApiSuccessEnvelope<AdminTagMergeResult>>(
        `${this.url}/${sourceTagId}/merge`,
        { targetTagId },
        { headers: new HttpHeaders({ 'x-idempotency-key': crypto.randomUUID() }) },
      )
      .pipe(map((response) => response.data));
  }
}
