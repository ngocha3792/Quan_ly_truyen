import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
    signal,
} from '@angular/core';

import { Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthApiService } from '../../../../core/auth/auth-api.service';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';

type VerificationStatus =
    | 'verifying'
    | 'success'
    | 'error';

@Component({
    selector: 'app-verify-email-page',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './verify-email-page.component.html',
    styleUrl: './verify-email-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailPageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly location = inject(Location);
    private readonly authApi = inject(AuthApiService);

    protected readonly status =
        signal<VerificationStatus>('verifying');

    protected readonly message = signal(
        'Đang xác minh địa chỉ email của bạn...',
    );

    protected readonly verifiedAt =
        signal<string | null>(null);

    ngOnInit(): void {
        const token = this.route.snapshot.queryParamMap
            .get('token')
            ?.trim();

        if (!token) {
            this.status.set('error');
            this.message.set(
                'Link xác minh không có token hoặc không hợp lệ.',
            );

            return;
        }

        /*
         * Xóa token khỏi thanh địa chỉ sau khi đã đọc.
         * Tránh token bị lưu trong lịch sử trình duyệt hoặc ảnh chụp màn hình.
         */
        this.location.replaceState('/verify-email');

        this.authApi.verifyEmail(token).subscribe({
            next: (result) => {
                this.status.set('success');

                this.message.set(
                    result.alreadyVerified
                        ? 'Email này đã được xác minh trước đó.'
                        : 'Xác minh email thành công.',
                );

                this.verifiedAt.set(
                    new Date(result.verifiedAt).toLocaleString('vi-VN'),
                );
            },

            error: (error: unknown) => {
                this.status.set('error');
                this.message.set(getApiErrorMessage(error));
            },
        });
    }
}