import {
    inject,
    Injectable,
    signal,
} from '@angular/core';

import {
    catchError,
    finalize,
    Observable,
    tap,
    throwError,
} from 'rxjs';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';

import {
    BeginMfaEnrollmentRequest,
    ConfirmMfaEnrollmentRequest,
    ConfirmMfaEnrollmentResponse,
    MfaEnrollment,
    MfaStatus,
    RegenerateRecoveryCodesResponse,
    VerifySensitiveActionRequest,
} from '../domain/account-security-settings.models';

import { AccountSecuritySettingsApiService } from './account-security-settings-api.service';

@Injectable({
    providedIn: 'root',
})
export class MfaSettingsStore {
    private readonly api =
        inject(AccountSecuritySettingsApiService);

    private readonly statusState =
        signal<MfaStatus | null>(null);

    private readonly enrollmentState =
        signal<MfaEnrollment | null>(null);

    private readonly recoveryCodesState =
        signal<readonly string[]>([]);

    private readonly loadingState =
        signal(false);

    private readonly submittingState =
        signal(false);

    private readonly errorState =
        signal<string | null>(null);

    private readonly successState =
        signal<string | null>(null);

    private loaded = false;

    readonly status =
        this.statusState.asReadonly();

    readonly enrollment =
        this.enrollmentState.asReadonly();

    readonly recoveryCodes =
        this.recoveryCodesState.asReadonly();

    readonly loading =
        this.loadingState.asReadonly();

    readonly submitting =
        this.submittingState.asReadonly();

    readonly error =
        this.errorState.asReadonly();

    readonly success =
        this.successState.asReadonly();

    load(force = false): void {
        if (
            this.loadingState() ||
            (this.loaded && !force)
        ) {
            return;
        }

        this.loadingState.set(true);
        this.errorState.set(null);

        this.api
            .getMfaStatus()
            .pipe(
                finalize(() => {
                    this.loadingState.set(false);
                }),
            )
            .subscribe({
                next: (status) => {
                    this.statusState.set(status);
                    this.loaded = true;
                },

                error: (error: unknown) => {
                    this.errorState.set(
                        getApiErrorMessage(error),
                    );
                },
            });
    }

    beginEnrollment(
        request: BeginMfaEnrollmentRequest,
    ): Observable<MfaEnrollment> {
        this.beginSubmission();

        return this.api
            .beginMfaEnrollment(request)
            .pipe(
                tap((enrollment) => {
                    this.enrollmentState.set(
                        enrollment,
                    );

                    this.recoveryCodesState.set(
                        [],
                    );
                }),

                catchError((error: unknown) =>
                    this.handleError(error),
                ),

                finalize(() => {
                    this.submittingState.set(false);
                }),
            );
    }

    confirmEnrollment(
        request: ConfirmMfaEnrollmentRequest,
    ): Observable<ConfirmMfaEnrollmentResponse> {
        this.beginSubmission();

        return this.api
            .confirmMfaEnrollment(request)
            .pipe(
                tap((response) => {
                    this.statusState.set(
                        response.status,
                    );

                    this.enrollmentState.set(null);

                    this.recoveryCodesState.set(
                        response.recoveryCodes,
                    );

                    this.successState.set(
                        'Xác thực hai lớp đã được bật.',
                    );
                }),

                catchError((error: unknown) =>
                    this.handleError(error),
                ),

                finalize(() => {
                    this.submittingState.set(false);
                }),
            );
    }

    disable(
        request: VerifySensitiveActionRequest,
    ): Observable<MfaStatus> {
        this.beginSubmission();

        return this.api
            .disableMfa(request)
            .pipe(
                tap((status) => {
                    this.statusState.set(status);
                    this.enrollmentState.set(null);
                    this.recoveryCodesState.set([]);

                    this.successState.set(
                        'Xác thực hai lớp đã được tắt.',
                    );
                }),

                catchError((error: unknown) =>
                    this.handleError(error),
                ),

                finalize(() => {
                    this.submittingState.set(false);
                }),
            );
    }

    regenerateRecoveryCodes(
        request: VerifySensitiveActionRequest,
    ): Observable<RegenerateRecoveryCodesResponse> {
        this.beginSubmission();

        return this.api
            .regenerateRecoveryCodes(request)
            .pipe(
                tap((response) => {
                    this.recoveryCodesState.set(
                        response.recoveryCodes,
                    );

                    this.statusState.update(
                        (status) =>
                            status
                                ? {
                                    ...status,
                                    recoveryCodesRemaining:
                                        response.recoveryCodes
                                            .length,
                                }
                                : status,
                    );

                    this.successState.set(
                        'Bộ mã khôi phục mới đã được tạo.',
                    );
                }),

                catchError((error: unknown) =>
                    this.handleError(error),
                ),

                finalize(() => {
                    this.submittingState.set(false);
                }),
            );
    }

    cancelEnrollment(): void {
        this.enrollmentState.set(null);
        this.errorState.set(null);
    }

    hideRecoveryCodes(): void {
        this.recoveryCodesState.set([]);
    }

    clearMessages(): void {
        this.errorState.set(null);
        this.successState.set(null);
    }

    private beginSubmission(): void {
        this.submittingState.set(true);
        this.errorState.set(null);
        this.successState.set(null);
    }

    private handleError(
        error: unknown,
    ): Observable<never> {
        this.errorState.set(
            getApiErrorMessage(error),
        );

        return throwError(() => error);
    }
}