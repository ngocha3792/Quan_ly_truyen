import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { AuthApiService } from '../../../../core/auth/auth-api.service';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ForgotPasswordRequest, ForgotPasswordResult } from '../domain/forgot-password.models';
import { ForgotPasswordRepository } from '../domain/forgot-password.repository';

@Injectable()
export class ForgotPasswordHttpRepository implements ForgotPasswordRepository {
  private readonly authApi = inject(AuthApiService);
  private readonly passwordResetConfig = inject(APP_RUNTIME_CONFIG).passwordReset;

  requestResetLink(request: ForgotPasswordRequest): Observable<ForgotPasswordResult> {
    const email = request.email.trim().toLocaleLowerCase();

    return this.authApi.forgotPassword(email).pipe(
      map((response) => ({
        email,
        requestedAt: new Date().toISOString(),

        expiresInMinutes: this.passwordResetConfig.tokenExpiresInMinutes,

        message: response.message,
      })),
    );
  }
}
