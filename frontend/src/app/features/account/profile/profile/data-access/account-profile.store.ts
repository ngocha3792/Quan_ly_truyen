import {
  computed,
  inject,
  Injectable,
  signal,
} from '@angular/core';

import {
  catchError,
  finalize,
  map,
  Observable,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

import {
  CurrentUser,
} from '../../../../../core/auth/auth.models';

import {
  AuthStore,
} from '../../../../../core/auth/auth.store';

import {
  getApiErrorMessage,
} from '../../../../../core/http/api-error.util';

import {
  AccountProfile,
  AccountProfileFormValue,
  ProfileCompletion,
  UpdateAccountProfileRequest,
} from '../domain/account-profile.models';

import {
  AccountAvatarUploadService,
} from './account-avatar-upload.service';

import {
  AccountProfileApiService,
} from './account-profile-api.service';

@Injectable({
  providedIn: 'root',
})
export class AccountProfileStore {
  private readonly auth =
    inject(AuthStore);

  private readonly api =
    inject(
      AccountProfileApiService,
    );

  private readonly avatarUpload =
    inject(
      AccountAvatarUploadService,
    );

  private readonly loadingState =
    signal(false);

  private readonly savingState =
    signal(false);

  private readonly errorState =
    signal<string | null>(
      null,
    );

  private readonly successState =
    signal<string | null>(
      null,
    );

  private loaded =
    false;

  readonly user =
    this.auth.user;

  readonly loading =
    this.loadingState.asReadonly();

  readonly saving =
    this.savingState.asReadonly();

  readonly error =
    this.errorState.asReadonly();

  readonly success =
    this.successState.asReadonly();

  readonly membershipLabel =
    computed(() => {
      const roles =
        this.user()
          ?.roles
          .map(
            role =>
              role.toLowerCase(),
          ) ??
        [];

      if (
        roles.includes(
          'admin',
        )
      ) {
        return 'Quản trị viên';
      }

      if (
        roles.includes(
          'author',
        )
      ) {
        return 'Tác giả';
      }

      return 'Thành viên';
    });

  readonly completion =
    computed<ProfileCompletion>(
      () => {
        const user =
          this.user();

        const items = [
          {
            label:
              'Ảnh đại diện',

            description:
              user?.avatar?.url
                ? 'Đã cập nhật'
                : 'Chưa cập nhật',

            completed:
              Boolean(
                user?.avatar?.url,
              ),
          },

          {
            label:
              'Email',

            description:
              user?.emailVerified
                ? 'Đã xác minh'
                : 'Chưa xác minh',

            completed:
              Boolean(
                user?.emailVerified,
              ),
          },

          {
            label:
              'Tên hiển thị',

            description:
              user?.displayName
                ?.trim()
                ? 'Đã hoàn thành'
                : 'Chưa hoàn thành',

            completed:
              Boolean(
                user?.displayName
                  ?.trim(),
              ),
          },

          {
            label:
              'Tiểu sử',

            description:
              user?.bio?.trim()
                ? 'Đã hoàn thành'
                : 'Chưa hoàn thành',

            completed:
              Boolean(
                user?.bio?.trim(),
              ),
          },
        ];

        const completedCount =
          items.filter(
            item =>
              item.completed,
          ).length;

        const percent =
          Math.round(
            (
              completedCount /
              items.length
            ) *
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
      },
    );

  load(
    force = false,
  ): void {
    if (
      this.loadingState() ||
      (
        this.loaded &&
        !force
      )
    ) {
      return;
    }

    this.loadingState.set(
      true,
    );

    this.errorState.set(
      null,
    );

    this.api
      .getProfile()
      .pipe(
        tap(
          profile => {
            this.applyProfile(
              profile,
            );

            this.loaded =
              true;
          },
        ),

        catchError(
          error => {
            this.loaded =
              false;

            this.errorState.set(
              getApiErrorMessage(
                error,
              ),
            );

            return throwError(
              () => error,
            );
          },
        ),

        finalize(
          () => {
            this.loadingState.set(
              false,
            );
          },
        ),
      )
      .subscribe({
        error: () => undefined,
      });
  }

  save(
    formValue:
      AccountProfileFormValue,

    avatarFile:
      File | null,
  ): Observable<CurrentUser> {
    const currentUser =
      this.user();

    if (!currentUser) {
      return throwError(
        () =>
          new Error(
            'Không tìm thấy phiên đăng nhập.',
          ),
      );
    }

    this.savingState.set(
      true,
    );

    this.errorState.set(
      null,
    );

    this.successState.set(
      null,
    );

    const avatarRequest$ =
      avatarFile
        ? this.avatarUpload
          .uploadAvatar(
            currentUser.id,

            avatarFile,
          )
          .pipe(
            map(
              media =>
                media.id,
            ),
          )
        : of(
          currentUser.avatar
            ?.id ??
          null,
        );

    return avatarRequest$.pipe(
      switchMap(
        avatarMediaId => {
          const request:
            UpdateAccountProfileRequest =
          {
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
        },
      ),

      map(
        profile =>
          this.applyProfile(
            profile,
          ),
      ),

      tap(
        () => {
          this.successState.set(
            'Thông tin cá nhân đã được cập nhật.',
          );
        },
      ),

      catchError(
        error => {
          this.errorState.set(
            getApiErrorMessage(
              error,
            ),
          );

          return throwError(
            () => error,
          );
        },
      ),

      finalize(
        () => {
          this.savingState.set(
            false,
          );
        },
      ),
    );
  }

  clearMessages(): void {
    this.errorState.set(null);
    this.successState.set(null);
  }

  private applyProfile(
    profile:
      AccountProfile,
  ): CurrentUser {
    const current =
      this.auth.user();

    if (!current) {
      throw new Error(
        'Không tìm thấy phiên đăng nhập.',
      );
    }

    const updated:
      CurrentUser = {
      ...current,

      email:
        profile.email,

      username:
        profile.username,

      displayName:
        profile.displayName,

      bio:
        profile.bio,

      status:
        profile.status,

      emailVerified:
        profile.emailVerified,

      emailVerifiedAt:
        profile.emailVerifiedAt,

      lastLoginAt:
        profile.lastLoginAt,

      avatar:
        profile.avatar,

      createdAt:
        profile.createdAt,

      updatedAt:
        profile.updatedAt,
    };

    this.auth.replaceCurrentUser(
      updated,
    );

    return updated;
  }
}
