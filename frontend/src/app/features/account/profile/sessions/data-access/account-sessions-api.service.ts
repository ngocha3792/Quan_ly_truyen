import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';

import { inject, Injectable } from '@angular/core';

import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../../core/http/api-envelope.model';

import {
  AccountSecurityEventsResponse,
  AccountSessionsResponse,
} from '../domain/account-session.models';

@Injectable({
  providedIn: 'root',
})
export class AccountSessionsApiService {
  private readonly http = inject(HttpClient);

  private readonly config = inject(APP_RUNTIME_CONFIG);

  private readonly authUrl = `${this.config.apiBaseUrl}/auth`;

  getSessions(): Observable<AccountSessionsResponse> {
    return this.http
      .get<ApiSuccessEnvelope<AccountSessionsResponse>>(`${this.authUrl}/sessions`)
      .pipe(map((response) => response.data));
  }

  getRecentSecurityEvents(limit = 10): Observable<AccountSecurityEventsResponse> {
    const params = new HttpParams().set('limit', String(limit));

    return this.http
      .get<ApiSuccessEnvelope<AccountSecurityEventsResponse>>(`${this.authUrl}/security-events`, {
        params,
      })
      .pipe(map((response) => response.data));
  }

  revokeSession(sessionId: string): Observable<void> {
    const headers = new HttpHeaders({
      'x-idempotency-key': crypto.randomUUID(),
    });

    /*
     * Nếu backend sử dụng:
     * POST /auth/sessions/:id/revoke
     * thì chỉ sửa method này.
     */
    return this.http
      .delete<ApiSuccessEnvelope<unknown> | null>(`${this.authUrl}/sessions/${sessionId}`, {
        headers,
      })
      .pipe(map(() => undefined));
  }
}
