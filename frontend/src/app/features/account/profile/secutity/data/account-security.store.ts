import { computed, inject, Injectable, signal } from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  catchError,
  finalize,
  map,
  Observable,
  of,
  switchMap,
  takeUntil,
  tap,
  throwError,
} from 'rxjs';

import { AuthSessionLifecycleService } from '../../../../../core/auth/auth-session-lifecycle.service';

import { AuthStore } from '../../../../../core/auth/auth.store';

import { getApiErrorMessage } from '../../../../../core/http/api-error.util';

import {
  AccountSecurityOverview,
  ChangeEmailRequest,
  ChangePasswordRequest,
  DeleteAccountRequest,
  EMPTY_SECURITY_OVERVIEW,
  SecurityScore,
  SecurityScoreItem,
} from './account-security.models';

import { AccountSecurityApiService } from './account-security-api.service';

@Injectable({
  providedIn: 'root',
})
export class AccountSecurityStore {
  private readonly api = inject(AccountSecurityApiService);

  private readonly auth = inject(AuthStore);

  private readonly lifecycle = inject(AuthSessionLifecycleService);

  private readonly overviewState = signal<AccountSecurityOverview>(EMPTY_SECURITY_OVERVIEW);

  private readonly loadingState = signal(false);

  private readonly submittingState = signal(false);

  private readonly errorState = signal<string | null>(null);

  private readonly successState = signal<string | null>(null);

  private loaded = false;

  readonly user = this.auth.user;

  readonly overview = this.overviewState.asReadonly();

  readonly loading = this.loadingState.asReadonly();

  readonly submitting = this.submittingState.asReadonly();

  readonly error = this.errorState.asReadonly();

  readonly success = this.successState.asReadonly();

  readonly securityScore = computed<SecurityScore>(() => {
    const overview = this.overviewState();

    const emailVerified = Boolean(this.user()?.emailVerified);

    const items: readonly SecurityScoreItem[] = [
      {
        id: 'password',

        label: 'Mật khẩu mạnh',

        description: overview.passwordConfigured ? 'Đã thiết lập' : 'Chưa thiết lập',

        completed: overview.passwordConfigured,
      },

      {
        id: 'mfa',

        label: 'Xác thực 2 lớp',

        description: overview.mfaEnabled ? 'Đã bật' : 'Chưa bật',

        completed: overview.mfaEnabled,
      },

      {
        id: 'recovery-email',

        label: 'Email khôi phục',

        description:
          overview.recoveryEmailVerified || emailVerified ? 'Đã xác minh' : 'Chưa xác minh',

        completed: overview.recoveryEmailVerified || emailVerified,
      },

      {
        id: 'security-questions',

        label: 'Câu hỏi bảo mật',

        description: overview.securityQuestionsConfigured ? 'Đã thiết lập' : 'Chưa thiết lập',

        completed: overview.securityQuestionsConfigured,
      },

      {
        id: 'trusted-device',

        label: 'Thiết bị tin cậy',

        description:
          overview.trustedDeviceCount > 0
            ? `${overview.trustedDeviceCount} thiết bị`
            : 'Chưa có thiết bị',

        completed: overview.trustedDeviceCount > 0,
      },
    ];

    let percent = 0;

    if (items[0].completed) {
      percent += 25;
    }

    if (items[2].completed) {
      percent += 25;
    }

    if (items[1].completed) {
      percent += 20;
    }

    if (items[3].completed) {
      percent += 15;
    }

    if (items[4].completed) {
      percent += 15;
    }

    if (percent >= 90) {
      return {
        percent,

        label: 'Xuất sắc',

        level: 'excellent',

        description: 'Tài khoản của bạn được bảo vệ rất tốt.',

        items,
      };
    }

    if (percent >= 70) {
      return {
        percent,

        label: 'Rất tốt',

        level: 'good',

        description: 'Tài khoản của bạn đang được bảo vệ tốt.',

        items,
      };
    }

    if (percent >= 50) {
      return {
        percent,

        label: 'Trung bình',

        level: 'medium',

        description: 'Hãy bổ sung thêm các thiết lập bảo mật.',

        items,
      };
    }

    return {
      percent,

      label: 'Cần cải thiện',

      level: 'low',

      description: 'Tài khoản của bạn cần được tăng cường bảo mật.',

      items,
    };
  });

  constructor() {
    this.lifecycle.changes$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.resetSessionState();
    });
  }

  load(force = false): void {
    if (this.loadingState() || (this.loaded && !force)) {
      return;
    }

    this.loadingState.set(true);

    this.errorState.set(null);

    this.api
      .getOverview()
      .pipe(
        catchError((error: unknown) => {
          this.errorState.set(getApiErrorMessage(error));

          return throwError(() => error);
        }),

        takeUntil(this.lifecycle.changes$),

        finalize(() => {
          this.loadingState.set(false);
        }),
      )
      .subscribe({
        next: (overview) => {
          this.overviewState.set(overview);

          this.loaded = true;
        },

        error: () => {
          this.loaded = false;
        },
      });
  }

  reload(): void {
    this.load(true);
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    this.submittingState.set(true);

    this.errorState.set(null);

    this.successState.set(null);

    return this.api.changePassword(request).pipe(
      switchMap((result) =>
        result.refreshRequired ? this.auth.refreshSession() : of(this.auth.user()),
      ),

      tap(() => {
        this.successState.set('Mật khẩu đã được thay đổi thành công.');

        this.overviewState.update((overview) => ({
          ...overview,

          passwordConfigured: true,

          passwordUpdatedAt: new Date().toISOString(),
        }));
      }),

      map(() => undefined),

      catchError((error: unknown) => {
        this.errorState.set(getApiErrorMessage(error));

        return throwError(() => error);
      }),

      takeUntil(this.lifecycle.changes$),

      finalize(() => {
        this.submittingState.set(false);
      }),
    );
  }

  requestEmailChange(request: ChangeEmailRequest): Observable<void> {
    this.submittingState.set(true);

    this.errorState.set(null);

    this.successState.set(null);

    return this.api.requestEmailChange(request).pipe(
      tap((result) => {
        const expiresAt = formatDateTime(result.expiresAt);

        this.successState.set(
          expiresAt
            ? [
                `Đã gửi link xác nhận tới ${result.pendingEmail}.`,
                `Link có hiệu lực đến ${expiresAt}.`,
                'Sau khi xác nhận, bạn sẽ cần đăng nhập lại.',
              ].join(' ')
            : [
                `Đã gửi link xác nhận tới ${result.pendingEmail}.`,
                'Sau khi xác nhận, bạn sẽ cần đăng nhập lại.',
              ].join(' '),
        );
      }),

      map(() => undefined),

      catchError((error: unknown) => {
        this.errorState.set(getApiErrorMessage(error));

        return throwError(() => error);
      }),

      takeUntil(this.lifecycle.changes$),

      finalize(() => {
        this.submittingState.set(false);
      }),
    );
  }

  deleteAccount(request: DeleteAccountRequest): Observable<void> {
    this.submittingState.set(true);

    this.errorState.set(null);

    this.successState.set(null);

    return this.api.deleteAccount(request).pipe(
      catchError((error: unknown) => {
        this.errorState.set(getApiErrorMessage(error));

        return throwError(() => error);
      }),

      takeUntil(this.lifecycle.changes$),

      finalize(() => {
        this.submittingState.set(false);
      }),
    );
  }

  clearMessages(): void {
    this.errorState.set(null);

    this.successState.set(null);
  }

  private resetSessionState(): void {
    this.overviewState.set(EMPTY_SECURITY_OVERVIEW);

    this.loadingState.set(false);

    this.submittingState.set(false);

    this.errorState.set(null);

    this.successState.set(null);

    this.loaded = false;
  }
}

function formatDateTime(value: string): string | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString('vi-VN', {
    dateStyle: 'short',

    timeStyle: 'short',
  });
}
