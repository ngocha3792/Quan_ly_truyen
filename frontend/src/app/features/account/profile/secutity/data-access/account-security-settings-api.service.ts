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

import { APP_RUNTIME_CONFIG } from '../../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../../core/http/api-envelope.model';

import {
    BeginMfaEnrollmentRequest,
    ConfirmMfaEnrollmentRequest,
    ConfirmMfaEnrollmentResponse,
    MfaEnrollment,
    MfaStatus,
    RecoveryEmailStatus,
    RegenerateRecoveryCodesResponse,
    RemoveRecoveryEmailRequest,
    RemoveSecurityQuestionsRequest,
    RequestRecoveryEmailRequest,
    SecurityQuestionOption,
    SecurityQuestionsState,
    UpdateSecurityQuestionsRequest,
    VerifyRecoveryEmailRequest,
    VerifySensitiveActionRequest,
} from '../domain/account-security-settings.models';

@Injectable({
    providedIn: 'root',
})
export class AccountSecuritySettingsApiService {
    private readonly http = inject(HttpClient);

    private readonly config =
        inject(APP_RUNTIME_CONFIG);

    private readonly securityUrl =
        `${this.config.apiBaseUrl}/auth/security`;

    getMfaStatus(): Observable<MfaStatus> {
        return this.get<MfaStatus>(
            `${this.securityUrl}/mfa`,
        );
    }

    beginMfaEnrollment(
        request: BeginMfaEnrollmentRequest,
    ): Observable<MfaEnrollment> {
        return this.post<MfaEnrollment>(
            `${this.securityUrl}/mfa/enrollment`,
            request,
            true,
        );
    }

    confirmMfaEnrollment(
        request: ConfirmMfaEnrollmentRequest,
    ): Observable<ConfirmMfaEnrollmentResponse> {
        return this.post<ConfirmMfaEnrollmentResponse>(
            `${this.securityUrl}/mfa/enrollment/confirm`,
            request,
            true,
        );
    }

    disableMfa(
        request: VerifySensitiveActionRequest,
    ): Observable<MfaStatus> {
        return this.delete<MfaStatus>(
            `${this.securityUrl}/mfa`,
            request,
            true,
        );
    }

    regenerateRecoveryCodes(
        request: VerifySensitiveActionRequest,
    ): Observable<RegenerateRecoveryCodesResponse> {
        return this.post<RegenerateRecoveryCodesResponse>(
            `${this.securityUrl}/mfa/recovery-codes`,
            request,
            true,
        );
    }

    getRecoveryEmailStatus():
        Observable<RecoveryEmailStatus> {
        return this.get<RecoveryEmailStatus>(
            `${this.securityUrl}/recovery-email`,
        );
    }

    requestRecoveryEmail(
        request: RequestRecoveryEmailRequest,
    ): Observable<RecoveryEmailStatus> {
        return this.post<RecoveryEmailStatus>(
            `${this.securityUrl}/recovery-email/request`,
            request,
            true,
        );
    }

    verifyRecoveryEmail(
        request: VerifyRecoveryEmailRequest,
    ): Observable<RecoveryEmailStatus> {
        return this.post<RecoveryEmailStatus>(
            `${this.securityUrl}/recovery-email/verify`,
            request,
            true,
        );
    }

    resendRecoveryEmailCode():
        Observable<RecoveryEmailStatus> {
        return this.post<RecoveryEmailStatus>(
            `${this.securityUrl}/recovery-email/resend`,
            {},
            true,
        );
    }

    removeRecoveryEmail(
        request: RemoveRecoveryEmailRequest,
    ): Observable<RecoveryEmailStatus> {
        return this.delete<RecoveryEmailStatus>(
            `${this.securityUrl}/recovery-email`,
            request,
            true,
        );
    }

    getSecurityQuestionCatalog():
        Observable<readonly SecurityQuestionOption[]> {
        return this.get<
            readonly SecurityQuestionOption[]
        >(`${this.securityUrl}/questions/catalog`);
    }

    getSecurityQuestions():
        Observable<SecurityQuestionsState> {
        return this.get<SecurityQuestionsState>(
            `${this.securityUrl}/questions`,
        );
    }

    updateSecurityQuestions(
        request: UpdateSecurityQuestionsRequest,
    ): Observable<SecurityQuestionsState> {
        return this.put<SecurityQuestionsState>(
            `${this.securityUrl}/questions`,
            request,
            true,
        );
    }

    removeSecurityQuestions(
        request: RemoveSecurityQuestionsRequest,
    ): Observable<SecurityQuestionsState> {
        return this.delete<SecurityQuestionsState>(
            `${this.securityUrl}/questions`,
            request,
            true,
        );
    }

    private get<T>(
        url: string,
    ): Observable<T> {
        return this.http
            .get<ApiSuccessEnvelope<T>>(url)
            .pipe(
                map((response) => response.data),
            );
    }

    private post<T>(
        url: string,
        body: unknown,
        idempotent = false,
    ): Observable<T> {
        return this.http
            .post<ApiSuccessEnvelope<T>>(
                url,
                body,
                {
                    headers: idempotent
                        ? this.createIdempotencyHeaders()
                        : undefined,
                },
            )
            .pipe(
                map((response) => response.data),
            );
    }

    private put<T>(
        url: string,
        body: unknown,
        idempotent = false,
    ): Observable<T> {
        return this.http
            .put<ApiSuccessEnvelope<T>>(
                url,
                body,
                {
                    headers: idempotent
                        ? this.createIdempotencyHeaders()
                        : undefined,
                },
            )
            .pipe(
                map((response) => response.data),
            );
    }

    private delete<T>(
        url: string,
        body: unknown,
        idempotent = false,
    ): Observable<T> {
        return this.http
            .delete<ApiSuccessEnvelope<T>>(
                url,
                {
                    body,
                    headers: idempotent
                        ? this.createIdempotencyHeaders()
                        : undefined,
                },
            )
            .pipe(
                map((response) => response.data),
            );
    }

    private createIdempotencyHeaders():
        HttpHeaders {
        return new HttpHeaders({
            'x-idempotency-key':
                crypto.randomUUID(),
        });
    }
}