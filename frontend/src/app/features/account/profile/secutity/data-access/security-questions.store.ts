import {
    inject,
    Injectable,
    signal,
} from '@angular/core';

import {
    catchError,
    finalize,
    forkJoin,
    Observable,
    tap,
    throwError,
} from 'rxjs';

import { getApiErrorMessage } from '../../../../../core/http/api-error.util';

import {
    RemoveSecurityQuestionsRequest,
    SecurityQuestionOption,
    SecurityQuestionsState,
    UpdateSecurityQuestionsRequest,
} from '../domain/account-security-settings.models';

import { AccountSecuritySettingsApiService } from './account-security-settings-api.service';

@Injectable({
    providedIn: 'root',
})
export class SecurityQuestionsStore {
    private readonly api =
        inject(AccountSecuritySettingsApiService);

    private readonly optionsState =
        signal<
            readonly SecurityQuestionOption[]
        >([]);

    private readonly state =
        signal<SecurityQuestionsState | null>(
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

    readonly options =
        this.optionsState.asReadonly();

    readonly questions =
        this.state.asReadonly();

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

        forkJoin({
            options:
                this.api.getSecurityQuestionCatalog(),

            state:
                this.api.getSecurityQuestions(),
        })
            .pipe(
                finalize(() => {
                    this.loadingState.set(false);
                }),
            )
            .subscribe({
                next: ({ options, state }) => {
                    this.optionsState.set(options);
                    this.state.set(state);
                    this.loaded = true;
                },

                error: (error: unknown) => {
                    this.errorState.set(
                        getApiErrorMessage(error),
                    );
                },
            });
    }

    save(
        request: UpdateSecurityQuestionsRequest,
    ): Observable<SecurityQuestionsState> {
        return this.execute(
            this.api.updateSecurityQuestions(
                request,
            ),
            'Câu hỏi bảo mật đã được cập nhật.',
        );
    }

    remove(
        request: RemoveSecurityQuestionsRequest,
    ): Observable<SecurityQuestionsState> {
        return this.execute(
            this.api.removeSecurityQuestions(
                request,
            ),
            'Câu hỏi bảo mật đã được xóa.',
        );
    }

    clearMessages(): void {
        this.errorState.set(null);
        this.successState.set(null);
    }

    private execute(
        request$: Observable<SecurityQuestionsState>,
        successMessage: string,
    ): Observable<SecurityQuestionsState> {
        this.submittingState.set(true);
        this.errorState.set(null);
        this.successState.set(null);

        return request$.pipe(
            tap((state) => {
                this.state.set(state);

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