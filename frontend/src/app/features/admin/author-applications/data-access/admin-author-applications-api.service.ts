import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';

import { inject, Injectable } from '@angular/core';

import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';

import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';

import {
  AdminAuthorApplicationListQuery,
  AdminAuthorApplicationListResponse,
  AdminAuthorApplicationRecord,
} from '../domain/admin-author-application.models';

@Injectable({
  providedIn: 'root',
})
export class AdminAuthorApplicationsApiService {
  private readonly http = inject(HttpClient);

  private readonly config = inject(APP_RUNTIME_CONFIG);

  private readonly baseUrl = `${this.config.apiBaseUrl}/author-applications/admin`;

  list(query: AdminAuthorApplicationListQuery): Observable<AdminAuthorApplicationListResponse> {
    let params = new HttpParams()
      .set('offset', String(query.offset))
      .set('limit', String(query.limit));

    if (query.status) {
      params = params.set(
        'status',

        query.status,
      );
    }

    const keyword = query.keyword?.trim();

    if (keyword) {
      params = params.set(
        'keyword',

        keyword,
      );
    }

    return this.http
      .get<ApiSuccessEnvelope<AdminAuthorApplicationListResponse>>(
        this.baseUrl,

        {
          params,
        },
      )
      .pipe(map((response) => response.data));
  }

  getOne(applicationId: string): Observable<AdminAuthorApplicationRecord> {
    return this.http
      .get<ApiSuccessEnvelope<AdminAuthorApplicationRecord>>(`${this.baseUrl}/${applicationId}`)
      .pipe(map((response) => response.data));
  }

  approve(
    applicationId: string,

    idempotencyKey: string,
  ): Observable<AdminAuthorApplicationRecord> {
    const headers = new HttpHeaders({
      'x-idempotency-key': idempotencyKey,
    });

    return this.http
      .post<ApiSuccessEnvelope<AdminAuthorApplicationRecord>>(
        `${this.baseUrl}/${applicationId}/approve`,

        {},

        {
          headers,
        },
      )
      .pipe(map((response) => response.data));
  }

  reject(
    applicationId: string,

    reason: string,

    idempotencyKey: string,
  ): Observable<AdminAuthorApplicationRecord> {
    const headers = new HttpHeaders({
      'x-idempotency-key': idempotencyKey,
    });

    return this.http
      .post<ApiSuccessEnvelope<AdminAuthorApplicationRecord>>(
        `${this.baseUrl}/${applicationId}/reject`,

        {
          reason: reason.trim(),
        },

        {
          headers,
        },
      )
      .pipe(map((response) => response.data));
  }
}
