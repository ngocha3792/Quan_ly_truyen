
import {
    DestroyRef,
    inject,
    Injectable,
    signal,
} from '@angular/core';
import {
    takeUntilDestroyed,
} from '@angular/core/rxjs-interop';
import {
    forkJoin,
} from 'rxjs';

import {
    ResetPasswordConfig,
    ResetPasswordResult,
    ResetPasswordStatus,
    ResetPasswordTokenValidation,
} from '../domain/reset-password.models';
import {
    ResetPasswordRepository,
} from '../domain/reset-password.repository';

@Injectable()
export class ResetPasswordStore {
    private readonly repository =
        inject(ResetPasswordRepository);

    private readonly destroyRef =
        inject(DestroyRef);

    readonly status =
        signal<ResetPasswordStatus>('idle');

    readonly config =
        signal<ResetPasswordConfig | null>(
            null,
        );

    readonly tokenValidation =
        signal<ResetPasswordTokenValidation | null>(
            null,
        );

    readonly result =
        signal<ResetPasswordResult | null>(
            null,
        );

    readonly errorMessage =
        signal('');

    readonly currentToken =
        signal('');

    initialize(token: string): void {
        if (this.status() === 'validating') {
            return;
        }

        this.currentToken.set(token);
        this.status.set('validating');
        this.errorMessage.set('');
        this.result.set(null);
        this.tokenValidation.set(null);

        forkJoin({
            config: this.repository.getConfig(),

            validation:
                this.repository.validateToken({
                    token,
                }),
        })
            .pipe(
                takeUntilDestroyed(
                    this.destroyRef,
                ),
            )
            .subscribe({
                next: ({
                    config,
                    validation,
                }) => {
                    this.config.set(config);
                    this.tokenValidation.set(
                        validation,
                    );

                    this.status.set('ready');
                },

                error: (error: unknown) => {
                    /*
                     * Config vẫn cần để card hiển thị
                     * yêu cầu mật khẩu khi thử lại.
                     */
                    this.config.set({
                        minimumLength: 8,
                        maximumLength: 64,
                        tokenExpiresInMinutes: 15,
                    });

                    this.handleTokenError(error);
                },
            });
    }

    submit(newPassword: string): void {
        if (
            this.status() === 'submitting'
        ) {
            return;
        }

        const token =
            this.currentToken();

        if (!token) {
            this.status.set('invalid');

            this.errorMessage.set(
                'Không tìm thấy mã đặt lại mật khẩu.',
            );

            return;
        }

        this.status.set('submitting');
        this.errorMessage.set('');
        this.result.set(null);

        this.repository
            .resetPassword({
                token,
                newPassword,
            })
            .pipe(
                takeUntilDestroyed(
                    this.destroyRef,
                ),
            )
            .subscribe({
                next: (result) => {
                    this.result.set(result);
                    this.status.set('success');
                },

                error: (error: unknown) => {
                    this.handleResetError(error);
                },
            });
    }

    retryValidation(): void {
        this.initialize(
            this.currentToken(),
        );
    }

    clearError(): void {
        if (this.status() === 'error') {
            this.status.set('ready');
        }

        this.errorMessage.set('');
    }

    private handleTokenError(
        error: unknown,
    ): void {
        const errorCode =
            error instanceof Error
                ? error.message
                : 'UNKNOWN_ERROR';

        switch (errorCode) {
            case 'EXPIRED_TOKEN':
                this.status.set('expired');

                this.errorMessage.set(
                    'Liên kết đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu một liên kết mới.',
                );

                break;

            case 'INVALID_TOKEN':
                this.status.set('invalid');

                this.errorMessage.set(
                    'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng.',
                );

                break;

            case 'MISSING_TOKEN':
                this.status.set('invalid');

                this.errorMessage.set(
                    'Liên kết không chứa mã đặt lại mật khẩu.',
                );

                break;

            default:
                this.status.set('error');

                this.errorMessage.set(
                    'Không thể kiểm tra liên kết đặt lại mật khẩu.',
                );
        }
    }

    private handleResetError(
        error: unknown,
    ): void {
        const errorCode =
            error instanceof Error
                ? error.message
                : 'UNKNOWN_ERROR';

        if (
            errorCode === 'EXPIRED_TOKEN'
        ) {
            this.status.set('expired');

            this.errorMessage.set(
                'Liên kết đặt lại mật khẩu đã hết hạn.',
            );

            return;
        }

        this.status.set('error');

        this.errorMessage.set(
            'Không thể cập nhật mật khẩu. Vui lòng thử lại.',
        );
    }
}