import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import { ApiSuccessEnvelope } from '../http/api-envelope.model';
import {
  CurrentUser,
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyEmailResponse,
} from './auth.models';
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/auth`;

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<ApiSuccessEnvelope<LoginResponse>>(`${this.baseUrl}/login`, payload)
      .pipe(map((response) => response.data));
  }

  register(payload: RegisterRequest): Observable<RegisterResponse> {
    const headers = new HttpHeaders({
      'x-idempotency-key': crypto.randomUUID(),
    });
    return this.http
      .post<ApiSuccessEnvelope<RegisterResponse>>(
        `${this.baseUrl}/register`,
        payload,
        { headers },
      )
      .pipe(map((response) => response.data));
  }

  refresh(): Observable<RefreshTokenResponse> {
    return this.http
      .post<ApiSuccessEnvelope<RefreshTokenResponse>>(
        `${this.baseUrl}/refresh`,
        {},
      )
      .pipe(map((response) => response.data));
  }

  me(): Observable<CurrentUser> {
    return this.http
      .get<ApiSuccessEnvelope<CurrentUser>>(`${this.baseUrl}/me`)
      .pipe(map((response) => response.data));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, {});
  }

  verifyEmail(token: string): Observable<VerifyEmailResponse> {
    return this.http
      .post<ApiSuccessEnvelope<VerifyEmailResponse>>(
        `${this.baseUrl}/verify-email`,
        { token },
      )
      .pipe(map((response) => response.data));
  }
}
