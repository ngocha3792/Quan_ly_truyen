import {
  HttpClient,
  HttpContext,
  HttpHeaders,
} from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import { ApiSuccessEnvelope } from '../http/api-envelope.model';
import { SKIP_AUTH_REFRESH } from '../http/auth-http.context';
import {
  AdminMfaAuthenticationResponse,
  AdminMfaEnrollmentResponse,
  ConfirmAdminMfaEnrollmentRequest,
  ConfirmEmailChangeResponse,
  CurrentUser,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordResponse,
  VerifyAdminMfaRequest,
  VerifyEmailResponse,
} from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/auth`;

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<ApiSuccessEnvelope<LoginResponse>>(
        `${this.baseUrl}/login`,
        payload,
        { context: this.skipRefreshContext() },
      )
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
        {
          headers,
          context: this.skipRefreshContext(),
        },
      )
      .pipe(map((response) => response.data));
  }

  refresh(): Observable<RefreshTokenResponse> {
    return this.http
      .post<ApiSuccessEnvelope<RefreshTokenResponse>>(
        `${this.baseUrl}/refresh`,
        {},
        { context: this.skipRefreshContext() },
      )
      .pipe(map((response) => response.data));
  }

  me(): Observable<CurrentUser> {
    return this.http
      .get<ApiSuccessEnvelope<CurrentUser>>(`${this.baseUrl}/me`)
      .pipe(map((response) => response.data));
  }

  logout(): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/logout`,
      {},
      { context: this.skipRefreshContext() },
    );
  }

  verifyEmail(token: string): Observable<VerifyEmailResponse> {
    return this.http
      .post<ApiSuccessEnvelope<VerifyEmailResponse>>(
        `${this.baseUrl}/verify-email`,
        { token },
        { context: this.skipRefreshContext() },
      )
      .pipe(map((response) => response.data));
  }

  resendVerification(email: string): Observable<{ accepted: true; message: string }> {
    return this.http
      .post<ApiSuccessEnvelope<{ accepted: true; message: string }>>(
        `${this.baseUrl}/resend-verification`,
        { email },
        { context: this.skipRefreshContext() },
      )
      .pipe(map((response) => response.data));
  }

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http
      .post<ApiSuccessEnvelope<ForgotPasswordResponse>>(
        `${this.baseUrl}/forgot-password`,
        { email },
        { context: this.skipRefreshContext() },
      )
      .pipe(map((response) => response.data));
  }

  resetPassword(
    token: string,
    newPassword: string,
  ): Observable<ResetPasswordResponse> {
    return this.http
      .post<ApiSuccessEnvelope<ResetPasswordResponse>>(
        `${this.baseUrl}/reset-password`,
        { token, newPassword },
        { context: this.skipRefreshContext() },
      )
      .pipe(map((response) => response.data));
  }

  confirmEmailChange(token: string): Observable<ConfirmEmailChangeResponse> {
    return this.http
      .post<ApiSuccessEnvelope<ConfirmEmailChangeResponse>>(
        `${this.baseUrl}/change-email/confirm`,
        { token },
        { context: this.skipRefreshContext() },
      )
      .pipe(map((response) => response.data));
  }

  beginAdminMfaEnrollment(
    mfaTicket: string,
  ): Observable<AdminMfaEnrollmentResponse> {
    return this.http
      .post<ApiSuccessEnvelope<AdminMfaEnrollmentResponse>>(
        `${this.baseUrl}/mfa/admin/enrollment`,
        { mfaTicket },
        { context: this.skipRefreshContext() },
      )
      .pipe(map((response) => response.data));
  }

  confirmAdminMfaEnrollment(
    request: ConfirmAdminMfaEnrollmentRequest,
  ): Observable<AdminMfaAuthenticationResponse> {
    return this.http
      .post<ApiSuccessEnvelope<AdminMfaAuthenticationResponse>>(
        `${this.baseUrl}/mfa/admin/enrollment/confirm`,
        request,
        { context: this.skipRefreshContext() },
      )
      .pipe(map((response) => response.data));
  }

  verifyAdminMfa(
    request: VerifyAdminMfaRequest,
  ): Observable<AdminMfaAuthenticationResponse> {
    return this.http
      .post<ApiSuccessEnvelope<AdminMfaAuthenticationResponse>>(
        `${this.baseUrl}/mfa/admin/verify`,
        request,
        { context: this.skipRefreshContext() },
      )
      .pipe(map((response) => response.data));
  }

  private skipRefreshContext(): HttpContext {
    return new HttpContext().set(SKIP_AUTH_REFRESH, true);
  }
}
