import {
    computed,
    inject,
    Injectable,
    signal,
} from '@angular/core';

import {
    catchError,
    finalize,
    Observable,
    of,
    switchMap,
    tap,
    throwError,
} from 'rxjs';

import { AuthStore } from '../../../../core/auth/auth.store';
import { CurrentUser } from '../../../../core/auth/auth.models';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';

import {
    AccountProfileFormValue,
    ProfileCompletion,
    UpdateAccountProfileRequest,
} from './account-profile.models';

import { AccountAvatarUploadService } from './account-avatar-upload.service';
import { AccountProfileApiService } from './account-profile-api.service';

@Injectable({
    providedIn: 'root',
})
export class AccountProfileStore {
    private readonly auth = inject(AuthStore);

    private readonly api =
        inject(AccountProfileApiService);

    private readonly avatarUpload =
        inject(AccountAvatarUploadService);

    private readonly savingState =
        signal(false);

    private readonly errorState =
        signal<string | null>(null);

    private readonly successState =
        signal<string | null>(null);

    readonly user = this.auth.user;
    readonly saving = this.savingState.asReadonly();
    readonly error = this.errorState.asReadonly();
    readonly success = this.successState.asReadonly();

    readonly membershipLabel = computed(() => {
        const roles =
            this.user()?.roles.map((role) =>
                role.toLowerCase(),
            ) ?? [];

        if (roles.includes('admin')) {
            return 'Quản trị viên';
        }

        if (roles.includes('author')) {
            return 'Tác giả';
        }

        return 'Thành viên';
    });

    readonly completion =
        computed<ProfileCompletion>(() => {
            const user = this.user();

            const items = [
                {
                    label: 'Ảnh đại diện',
                    description: user?.avatar?.url
                        ? 'Đã cập nhật'
                        : 'Chưa cập nhật',
                    completed: Boolean(
                        user?.avatar?.url,
                    ),
                },
                {
                    label: 'Email',
                    description: user?.emailVerified
                        ? 'Đã xác minh'
                        : 'Chưa xác minh',
                    completed: Boolean(
                        user?.emailVerified,
                    ),
                },
                {
                    label: 'Tên hiển thị',
                    description:
                        user?.displayName?.trim()
                            ? 'Đã hoàn thành'
                            : 'Chưa hoàn thành',
                    completed: Boolean(
                        user?.displayName?.trim(),
                    ),
                },
                {
                    label: 'Tiểu sử',
                    description:
                        user?.bio?.trim()
                            ? 'Đã hoàn thành'
                            : 'Chưa hoàn thành',
                    completed: Boolean(
                        user?.bio?.trim(),
                    ),
                },
            ];

            const completedCount =
                items.filter(
                    (item) => item.completed,
                ).length;

            const percent = Math.round(
                (completedCount / items.length) *
                100,
            );

            return {
                percent,
                items,
                message:
                    percent === 100
                        ? 'Hồ sơ của bạn đã hoàn thiện.'
                        : percent >= 75
                            ? 'Hồ sơ của bạn rất đầy đủ!'
                            : 'Hãy bổ sung thêm thông tin hồ sơ.',
            };
        });

    save(
        formValue: AccountProfileFormValue,
        avatarFile: File | null,
    ): Observable<CurrentUser> {
        const currentUser = this.user();

        if (!currentUser) {
            return throwError(
                () =>
                    new Error(
                        'Không tìm thấy phiên đăng nhập.',
                    ),
            );
        }

        this.savingState.set(true);
        this.errorState.set(null);
        this.successState.set(null);

        const avatarRequest$ = avatarFile
            ? this.avatarUpload
                .uploadAvatar(
                    currentUser.id,
                    avatarFile,
                )
                .pipe(
                    switchMap((media) =>
                        of(media.id),
                    ),
                )
            : of(
                currentUser.avatar?.id ?? null,
            );

        return avatarRequest$.pipe(
            switchMap((avatarMediaId) => {
                const request:
                    UpdateAccountProfileRequest = {
                    displayName:
                        formValue.displayName.trim(),

                    bio:
                        formValue.bio.trim() ||
                        null,

                    avatarMediaId,
                };

                return this.api.updateProfile(
                    request,
                );
            }),

            tap((updatedUser) => {
                this.auth.replaceCurrentUser(
                    updatedUser,
                );

                this.successState.set(
                    'Thông tin cá nhân đã được cập nhật.',
                );
            }),

            catchError((error: unknown) => {
                this.errorState.set(
                    getApiErrorMessage(error),
                );

                return throwError(() => error);
            }),

            finalize(() => {
                this.savingState.set(false);
            }),
        );
    }

    clearMessages(): void {
        this.errorState.set(null);
        this.successState.set(null);
    }
}