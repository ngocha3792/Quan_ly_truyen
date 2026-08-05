import {
  HttpClient,
  HttpHeaders,
} from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import {
  AccountSecurityOverview,
  ChangePasswordRequest,
  ChangePasswordResponse,
  DeleteAccountRequest,
} from './account-security.models';

@Injectable({
  providedIn: 'root',
})
export class AccountSecurityApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly authUrl = `${this.config.apiBaseUrl}/auth`;

  getOverview(): Observable<AccountSecurityOverview> {
    return this.http
      .get<ApiSuccessEnvelope<AccountSecurityOverview>>(
        `${this.authUrl}/security-overview`,
      )
      .pipe(map((response) => response.data));
  }

  changePassword(
    request: ChangePasswordRequest,
  ): Observable<ChangePasswordResponse> {
    return this.http
      .post<ApiSuccessEnvelope<ChangePasswordResponse>>(
        `${this.authUrl}/change-password`,
        request,
      )
      .pipe(map((response) => response.data));
  }

  deleteAccount(request: DeleteAccountRequest): Observable<void> {
    const headers = new HttpHeaders({
      'x-idempotency-key': crypto.randomUUID(),
    });

    return this.http.delete<void>(`${this.authUrl}/account`, {
      headers,
      body: request,
    });
  }
}
