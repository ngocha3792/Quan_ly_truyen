
import {
    DestroyRef,
    inject,
    Injectable,
    signal,
} from '@angular/core';
import {
    takeUntilDestroyed,
} from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import {
    ForgotPasswordResult,
    ForgotPasswordStatus,
} from '../domain/forgot-password.models';
import { ForgotPasswordRepository } from '../domain/forgot-password.repository';

@Injectable()
export class ForgotPasswordStore {
    private readonly repository =
        inject(ForgotPasswordRepository);

    private readonly destroyRef =
        inject(DestroyRef);

    readonly status =
        signal<ForgotPasswordStatus>('idle');

    readonly result =
        signal<ForgotPasswordResult | null>(
            null,
        );

    readonly errorMessage =
        signal('');

    readonly submittedEmail =
        signal('');

    requestResetLink(email: string): void {
        if (this.status() === 'submitting') {
            return;
        }

        const normalizedEmail = email
            .trim()
            .toLocaleLowerCase();

        this.status.set('submitting');
        this.errorMessage.set('');
        this.result.set(null);
        this.submittedEmail.set(normalizedEmail);

        this.repository
            .requestResetLink({
                email: normalizedEmail,
            })
            .pipe(
                takeUntilDestroyed(
                    this.destroyRef,
                ),

                finalize(() => {
                    if (
                        this.status() === 'submitting'
                    ) {
                        this.status.set('idle');
                    }
                }),
            )
            .subscribe({
                next: (result) => {
                    this.result.set(result);
                    this.status.set('success');
                },

                error: () => {
                    this.status.set('error');

                    this.errorMessage.set(
                        'Không thể gửi liên kết đặt lại mật khẩu. Vui lòng thử lại sau.',
                    );
                },
            });
    }

    retry(): void {
        const email = this.submittedEmail();

        if (!email) {
            this.status.set('idle');
            this.errorMessage.set('');
            return;
        }

        this.requestResetLink(email);
    }

    useAnotherEmail(): void {
        this.status.set('idle');
        this.result.set(null);
        this.errorMessage.set('');
        this.submittedEmail.set('');
    }

    clearError(): void {
        if (this.status() === 'error') {
            this.status.set('idle');
        }

        this.errorMessage.set('');
    }
}