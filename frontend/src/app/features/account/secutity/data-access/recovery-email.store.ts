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
    RecoveryEmailStatus,
    RemoveRecoveryEmailRequest,
    RequestRecoveryEmailRequest,
    VerifyRecoveryEmailRequest,
} from '../domain/account-security-settings.models';

import { AccountSecuritySettingsApiService } from './account-security-settings-api.service';

@Injectable({
    providedIn: 'root',
})
export class RecoveryEmailStore {
    private readonly api =
        inject(AccountSecuritySettingsApiService);

    private readonly statusState =
        signal<RecoveryEmailStatus | null>(
            null,
        );

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
            .getRecoveryEmailStatus()
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

    request(
        request: RequestRecoveryEmailRequest,
    ): Observable<RecoveryEmailStatus> {
        return this.execute(
            this.api.requestRecoveryEmail(request),
            'Mã xác minh đã được gửi tới email khôi phục.',
        );
    }

    verify(
        request: VerifyRecoveryEmailRequest,
    ): Observable<RecoveryEmailStatus> {
        return this.execute(
            this.api.verifyRecoveryEmail(request),
            'Email khôi phục đã được xác minh.',
        );
    }

    resend():
        Observable<RecoveryEmailStatus> {
        return this.execute(
            this.api.resendRecoveryEmailCode(),
            'Mã xác minh mới đã được gửi.',
        );
    }

    remove(
        request: RemoveRecoveryEmailRequest,
    ): Observable<RecoveryEmailStatus> {
        return this.execute(
            this.api.removeRecoveryEmail(request),
            'Email khôi phục đã được xóa.',
        );
    }

    clearMessages(): void {
        this.errorState.set(null);
        this.successState.set(null);
    }

    private execute(
        request$: Observable<RecoveryEmailStatus>,
        successMessage: string,
    ): Observable<RecoveryEmailStatus> {
        this.submittingState.set(true);
        this.errorState.set(null);
        this.successState.set(null);

        return request$.pipe(
            tap((status) => {
                this.statusState.set(status);
                this.successState.set(
                    successMessage,
                );
            }),

            catchError((error: unknown) => {
                this.errorState.set(
                    getApiErrorMessage(error),
                );

                return throwError(() => error);
            }),

            finalize(() => {
                this.submittingState.set(false);
            }),
        );
    }
}