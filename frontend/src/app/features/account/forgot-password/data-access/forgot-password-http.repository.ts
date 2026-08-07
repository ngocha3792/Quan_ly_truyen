import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { AuthApiService } from '../../../../core/auth/auth-api.service';
import { ForgotPasswordRequest, ForgotPasswordResult } from '../domain/forgot-password.models';
import { ForgotPasswordRepository } from '../domain/forgot-password.repository';

@Injectable()
export class ForgotPasswordHttpRepository implements ForgotPasswordRepository {
  private readonly authApi = inject(AuthApiService);

  requestResetLink(request: ForgotPasswordRequest): Observable<ForgotPasswordResult> {
    const email = request.email.trim().toLocaleLowerCase();

    return this.authApi.forgotPassword(email).pipe(
      map((response) => ({
        email,
        requestedAt: new Date().toISOString(),

        /*
         * Backend hiện dùng:
         * PasswordResetPolicy.TTL_MINUTES = 15
         *
         * API forgot-password chỉ trả:
         * {
         *   accepted: true,
         *   message: string
         * }
         *
         * nên frontend giữ giá trị 15 phút
         * để hiển thị UI hiện tại.
         */
        expiresInMinutes: 15,

        message: response.message,
      })),
    );
  }
}
