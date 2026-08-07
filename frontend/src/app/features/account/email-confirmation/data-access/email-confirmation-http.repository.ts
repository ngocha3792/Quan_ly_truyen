import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

import { AuthApiService } from '../../../../core/auth/auth-api.service';
import { ApiErrorEnvelope } from '../../../../core/http/api-envelope.model';
import {
  EmailConfirmationRequest,
  EmailConfirmationResult,
} from '../domain/email-confirmation.models';
import { EmailConfirmationRepository } from '../domain/email-confirmation.repository';

@Injectable()
export class EmailConfirmationHttpRepository implements EmailConfirmationRepository {
  private readonly authApi = inject(AuthApiService);

  confirmEmail(request: EmailConfirmationRequest): Observable<EmailConfirmationResult> {
    const token = request.token.trim();

    if (!token) {
      return throwError(() => new Error('MISSING_TOKEN'));
    }

    /*
     * Giữ cùng validation với backend:
     *
     * - length: 32 -> 512
     * - Base64 URL safe:
     *   A-Z a-z 0-9 _ -
     */
    const tokenPattern = /^[A-Za-z0-9_-]{32,512}$/;

    if (!tokenPattern.test(token)) {
      return throwError(() => new Error('INVALID_TOKEN'));
    }

    return this.authApi.confirmEmailChange(token).pipe(
      map((response) => ({
        email: response.email,

        /*
         * Backend gọi field này là
         * changedAt.
         *
         * Model UI hiện tại gọi là
         * confirmedAt nên map lại.
         */
        confirmedAt: response.changedAt,

        message: response.alreadyChanged
          ? 'Email mới đã được xác nhận trước đó.'
          : 'Email mới của bạn đã được xác nhận thành công.',
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
      case 'AUTH_EMAIL_CHANGE_TOKEN_EXPIRED':
        return throwError(() => new Error('EXPIRED_TOKEN'));

      case 'AUTH_EMAIL_CHANGE_TOKEN_INVALID':
        return throwError(() => new Error('INVALID_TOKEN'));

      case 'AUTH_EMAIL_ALREADY_IN_USE':
        return throwError(() => new Error('EMAIL_IN_USE'));

      default:
        return throwError(() => error);
    }
  }
}
