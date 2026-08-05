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
    UpdateAccountProfileRequest,
    UpdateAccountProfileResponse,
} from './account-profile.models';

@Injectable({
    providedIn: 'root',
})
export class AccountProfileApiService {
    private readonly http = inject(HttpClient);
    private readonly config = inject(APP_RUNTIME_CONFIG);

    private readonly authUrl =
        `${this.config.apiBaseUrl}/auth`;

    updateProfile(
        request: UpdateAccountProfileRequest,
    ): Observable<UpdateAccountProfileResponse> {
        const headers = new HttpHeaders({
            'x-idempotency-key': crypto.randomUUID(),
        });

        return this.http
            .patch<
                ApiSuccessEnvelope<UpdateAccountProfileResponse>
            >(
                `${this.authUrl}/profile`,
                request,
                { headers },
            )
            .pipe(
                map((response) => response.data),
            );
    }
}