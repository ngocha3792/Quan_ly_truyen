
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
    EmailConfirmationResult,
    EmailConfirmationStatus,
} from '../domain/email-confirmation.models';
import {
    EmailConfirmationRepository,
} from '../domain/email-confirmation.repository';

@Injectable()
export class EmailConfirmationStore {
    private readonly repository =
        inject(EmailConfirmationRepository);

    private readonly destroyRef =
        inject(DestroyRef);

    readonly status =
        signal<EmailConfirmationStatus>('idle');

    readonly result =
        signal<EmailConfirmationResult | null>(
            null,
        );

    readonly errorMessage =
        signal('');

    readonly currentToken =
        signal('');

    confirm(token: string): void {
        if (this.status() === 'confirming') {
            return;
        }

        this.currentToken.set(token);
        this.status.set('confirming');
        this.result.set(null);
        this.errorMessage.set('');

        this.repository
            .confirmEmail({
                token,
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
                    this.handleError(error);
                },
            });
    }

    retry(): void {
        const token =
            this.currentToken();

        if (!token) {
            this.status.set('error');

            this.errorMessage.set(
                'Không tìm thấy mã xác nhận email.',
            );

            return;
        }

        this.confirm(token);
    }

    private handleError(
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
                    'Liên kết xác nhận đã hết hạn. Vui lòng yêu cầu gửi lại email xác nhận.',
                );

                break;

            case 'MISSING_TOKEN':
                this.status.set('error');

                this.errorMessage.set(
                    'Liên kết xác nhận không chứa mã xác thực.',
                );

                break;

            case 'INVALID_TOKEN':
                this.status.set('error');

                this.errorMessage.set(
                    'Liên kết xác nhận không hợp lệ hoặc đã được sử dụng.',
                );

                break;

            default:
                this.status.set('error');

                this.errorMessage.set(
                    'Không thể xác nhận email. Vui lòng thử lại sau.',
                );
        }
    }
}