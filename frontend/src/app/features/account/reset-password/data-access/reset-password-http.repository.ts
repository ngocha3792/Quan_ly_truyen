import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, throwError } from 'rxjs';

import { AuthApiService } from '../../../../core/auth/auth-api.service';
import { ApiErrorEnvelope } from '../../../../core/http/api-envelope.model';
import {
  ResetPasswordConfig,
  ResetPasswordRequest,
  ResetPasswordResult,
  ResetPasswordTokenRequest,
  ResetPasswordTokenValidation,
} from '../domain/reset-password.models';
import { ResetPasswordRepository } from '../domain/reset-password.repository';

const RESET_PASSWORD_CONFIG: ResetPasswordConfig = {
  minimumLength: 8,
  maximumLength: 72,
  tokenExpiresInMinutes: 15,
};

@Injectable()
export class ResetPasswordHttpRepository implements ResetPasswordRepository {
  private readonly authApi = inject(AuthApiService);

  getConfig(): Observable<ResetPasswordConfig> {
    /*
     * Backend hiện chưa có password-policy endpoint.
     */
    return of(RESET_PASSWORD_CONFIG);
  }

  validateToken(request: ResetPasswordTokenRequest): Observable<ResetPasswordTokenValidation> {
    const token = request.token.trim();

    if (!token) {
      return throwError(() => new Error('MISSING_TOKEN'));
    }

    /*
     * Không còn tự giả định token hợp lệ
     * dựa trên format nữa.
     *
     * Backend kiểm tra:
     * - token tồn tại
     * - đúng PASSWORD_RESET
     * - chưa consume
     * - chưa expire
     * - user chưa bị delete
     */
    return this.authApi.validateResetPasswordToken(token).pipe(
      map((response) => ({
        isValid: response.valid,

        expiresAt: response.expiresAt,
      })),

      catchError((error: unknown) => this.handleApiError(error)),
    );
  }

  resetPassword(request: ResetPasswordRequest): Observable<ResetPasswordResult> {
    const token = request.token.trim();

    return this.authApi.resetPassword(token, request.newPassword).pipe(
      map((response) => ({
        changedAt: response.resetAt,

        sessionsRevoked: response.sessionsRevoked,

        message: 'Mật khẩu của bạn đã được cập nhật thành công.',
      })),

      catchError((error: unknown) => this.handleApiError(error)),
    );
  }

  private handleApiError(error: unknown): Observable<never> {
    if (!(error instanceof HttpErrorResponse)) {
      return throwError(() => error);
    }

    const body = error.error as ApiErrorEnvelope | undefined;

    const code = body?.error?.code;

    switch (code) {
      case 'AUTH_PASSWORD_RESET_TOKEN_EXPIRED':
        return throwError(() => new Error('EXPIRED_TOKEN'));

      case 'AUTH_PASSWORD_RESET_TOKEN_INVALID':
        return throwError(() => new Error('INVALID_TOKEN'));

      case 'AUTH_INVALID_PASSWORD':
        return throwError(() => new Error('INVALID_PASSWORD'));

      default:
        return throwError(() => error);
    }
  }
}
