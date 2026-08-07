
import { Injectable } from '@angular/core';
import {
    delay,
    Observable,
    of,
    throwError,
} from 'rxjs';

import {
    ResetPasswordConfig,
    ResetPasswordRequest,
    ResetPasswordResult,
    ResetPasswordTokenRequest,
    ResetPasswordTokenValidation,
} from '../domain/reset-password.models';
import {
    ResetPasswordRepository,
} from '../domain/reset-password.repository';
import {
    RESET_PASSWORD_CONFIG_MOCK,
    RESET_PASSWORD_RESULT_MOCK,
    RESET_PASSWORD_TOKEN_MOCK,
} from '../mock/reset-password.mock';

@Injectable()
export class ResetPasswordMockRepository
    implements ResetPasswordRepository {
    getConfig():
        Observable<ResetPasswordConfig> {
        return of(
            RESET_PASSWORD_CONFIG_MOCK,
        ).pipe(
            delay(200),
        );
    }

    validateToken(
        request: ResetPasswordTokenRequest,
    ): Observable<ResetPasswordTokenValidation> {
        const token = request.token.trim();

        if (!token) {
            return throwError(
                () => new Error('MISSING_TOKEN'),
            );
        }

        if (token === 'expired-token') {
            return throwError(
                () => new Error('EXPIRED_TOKEN'),
            );
        }

        if (token === 'invalid-token') {
            return throwError(
                () => new Error('INVALID_TOKEN'),
            );
        }

        return of({
            ...RESET_PASSWORD_TOKEN_MOCK,

            expiresAt: new Date(
                Date.now() +
                RESET_PASSWORD_CONFIG_MOCK
                    .tokenExpiresInMinutes *
                60 *
                1000,
            ).toISOString(),
        }).pipe(
            delay(700),
        );
    }

    resetPassword(
        request: ResetPasswordRequest,
    ): Observable<ResetPasswordResult> {
        /*
         * Dùng mật khẩu này để kiểm tra giao diện lỗi API:
         * ServerError@123
         */
        if (
            request.newPassword ===
            'ServerError@123'
        ) {
            return throwError(
                () => new Error('RESET_FAILED'),
            );
        }

        if (
            request.token === 'expired-token'
        ) {
            return throwError(
                () => new Error('EXPIRED_TOKEN'),
            );
        }

        return of({
            ...RESET_PASSWORD_RESULT_MOCK,
            changedAt: new Date().toISOString(),
        }).pipe(
            delay(900),
        );
    }
}