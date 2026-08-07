
import { Injectable } from '@angular/core';
import {
    delay,
    Observable,
    of,
    throwError,
} from 'rxjs';

import {
    ForgotPasswordRequest,
    ForgotPasswordResult,
} from '../domain/forgot-password.models';
import { ForgotPasswordRepository } from '../domain/forgot-password.repository';
import { FORGOT_PASSWORD_RESULT_MOCK } from '../mock/forgot-password.mock';

@Injectable()
export class ForgotPasswordMockRepository
    implements ForgotPasswordRepository {
    requestResetLink(
        request: ForgotPasswordRequest,
    ): Observable<ForgotPasswordResult> {
        const email = request.email
            .trim()
            .toLocaleLowerCase();

        /*
         * Email này dùng để kiểm tra giao diện lỗi.
         */
        if (email === 'error@example.com') {
            return throwError(
                () => new Error('REQUEST_FAILED'),
            ).pipe(
                delay(850),
            );
        }

        return of({
            ...FORGOT_PASSWORD_RESULT_MOCK,
            email,
            requestedAt: new Date().toISOString(),
        }).pipe(
            delay(900),
        );
    }
}