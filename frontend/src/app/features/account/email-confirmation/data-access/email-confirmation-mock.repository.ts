
import { Injectable } from '@angular/core';
import {
    delay,
    Observable,
    of,
    throwError,
} from 'rxjs';

import {
    EmailConfirmationRequest,
    EmailConfirmationResult,
} from '../domain/email-confirmation.models';
import {
    EmailConfirmationRepository,
} from '../domain/email-confirmation.repository';
import {
    EMAIL_CONFIRMATION_RESULT_MOCK,
} from '../mock/email-confirmation.mock';

@Injectable()
export class EmailConfirmationMockRepository
    implements EmailConfirmationRepository {
    confirmEmail(
        request: EmailConfirmationRequest,
    ): Observable<EmailConfirmationResult> {
        const token = request.token.trim();

        if (!token) {
            return throwError(
                () => new Error('MISSING_TOKEN'),
            ).pipe(
                delay(650),
            );
        }

        if (token === 'expired-token') {
            return throwError(
                () => new Error('EXPIRED_TOKEN'),
            ).pipe(
                delay(650),
            );
        }

        if (token === 'invalid-token') {
            return throwError(
                () => new Error('INVALID_TOKEN'),
            ).pipe(
                delay(650),
            );
        }

        return of({
            ...EMAIL_CONFIRMATION_RESULT_MOCK,
            confirmedAt: new Date().toISOString(),
        }).pipe(
            delay(850),
        );
    }
}