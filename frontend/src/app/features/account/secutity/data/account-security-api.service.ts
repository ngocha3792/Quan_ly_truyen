import {
    HttpClient,
    HttpHeaders,
} from '@angular/common/http';

import {
    inject,
    Injectable,
} from '@angular/core';

import {
    map,
    Observable,
} from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';

import {
    AccountSecurityOverview,
    ChangePasswordRequest,
    DeleteAccountRequest,
} from './account-security.models';

@Injectable({
    providedIn: 'root',
})
export class AccountSecurityApiService {
    private readonly http = inject(HttpClient);
    private readonly config =
        inject(APP_RUNTIME_CONFIG);

    private readonly authUrl =
        `${this.config.apiBaseUrl}/auth`;

    /**
     * Endpoint tổng hợp trạng thái bảo mật.
     *
     * Backend nên trả trạng thái MFA, recovery email,
     * security questions và trusted devices.
     */
    getOverview():
        Observable<AccountSecurityOverview> {
        return this.http
            .get<
                ApiSuccessEnvelope<AccountSecurityOverview>
            >(`${this.authUrl}/security-overview`)
            .pipe(
                map((response) => response.data),
            );
    }

    changePassword(
        request: ChangePasswordRequest,
    ): Observable<void> {
        const headers = new HttpHeaders({
            'x-idempotency-key':
                crypto.randomUUID(),
        });

        return this.http
            .post<ApiSuccessEnvelope<unknown>>(
                `${this.authUrl}/change-password`,
                request,
                { headers },
            )
            .pipe(
                map(() => undefined),
            );
    }

    deleteAccount(
        request: DeleteAccountRequest,
    ): Observable<void> {
        const headers = new HttpHeaders({
            'x-idempotency-key':
                crypto.randomUUID(),
        });

        return this.http
            .delete<ApiSuccessEnvelope<unknown>>(
                `${this.authUrl}/account`,
                {
                    headers,
                    body: request,
                },
            )
            .pipe(
                map(() => undefined),
            );
    }

    requestMfaSetup(): Observable<{
        readonly setupToken: string;
    }> {
        const headers = new HttpHeaders({
            'x-idempotency-key':
                crypto.randomUUID(),
        });

        return this.http
            .post<
                ApiSuccessEnvelope<{
                    readonly setupToken: string;
                }>
            >(
                `${this.authUrl}/mfa/setup`,
                {},
                { headers },
            )
            .pipe(
                map((response) => response.data),
            );
    }
}