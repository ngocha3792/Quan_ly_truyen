import {
    HttpClient,
    HttpParams,
} from '@angular/common/http';

import {
    inject,
    Injectable,
} from '@angular/core';

import {
    map,
    Observable,
} from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../../core/http/api-envelope.model';

import {
    AccountSecurityEventsResponse,
    ActivitySessionsResponse,
} from '../domain/account-activity.models';

@Injectable({
    providedIn: 'root',
})
export class AccountActivityApiService {
    private readonly http =
        inject(HttpClient);

    private readonly config =
        inject(APP_RUNTIME_CONFIG);

    private readonly authUrl =
        `${this.config.apiBaseUrl}/auth`;

    getSecurityEvents(
        limit = 100,
    ): Observable<AccountSecurityEventsResponse> {
        const params =
            new HttpParams().set(
                'limit',
                String(limit),
            );

        return this.http
            .get<
                ApiSuccessEnvelope<AccountSecurityEventsResponse>
            >(
                `${this.authUrl}/security-events`,
                { params },
            )
            .pipe(
                map((response) => response.data),
            );
    }

    getSessions():
        Observable<ActivitySessionsResponse> {
        return this.http
            .get<
                ApiSuccessEnvelope<ActivitySessionsResponse>
            >(`${this.authUrl}/sessions`)
            .pipe(
                map((response) => response.data),
            );
    }
}