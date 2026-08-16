import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import type {
  AdminAuthorDetail,
  AdminAuthorListResponse,
  AuthorLifecycleStatus,
} from '../domain/admin-author.models';
@Injectable({ providedIn: 'root' })
export class AdminAuthorsApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/admin/authors`;
  list(input: {
    search?: string;
    status?: AuthorLifecycleStatus;
    createdFrom?: string;
    createdTo?: string;
    page: number;
    pageSize: number;
  }): Observable<AdminAuthorListResponse> {
    let params = new HttpParams()
      .set('page', String(input.page))
      .set('pageSize', String(input.pageSize));
    if (input.search?.trim()) params = params.set('search', input.search.trim());
    if (input.status) params = params.set('status', input.status);
    if (input.createdFrom) params = params.set('createdFrom', input.createdFrom);
    if (input.createdTo) params = params.set('createdTo', input.createdTo);
    return this.http
      .get<ApiSuccessEnvelope<AdminAuthorListResponse>>(this.baseUrl, { params })
      .pipe(map((r) => r.data));
  }
  detail(id: string): Observable<AdminAuthorDetail> {
    return this.http
      .get<ApiSuccessEnvelope<AdminAuthorDetail>>(`${this.baseUrl}/${id}`)
      .pipe(map((r) => r.data));
  }
  changeStatus(
    id: string,
    status: AuthorLifecycleStatus,
    reason?: string,
  ): Observable<AdminAuthorDetail> {
    return this.http
      .patch<ApiSuccessEnvelope<AdminAuthorDetail>>(`${this.baseUrl}/${id}/status`, {
        status,
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
      })
      .pipe(map((r) => r.data));
  }
}
