import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';

import { AuthStore } from '../../../../../core/auth/auth.store';

import { AuthDialogComponent } from '../../ui/auth-dialog/auth-dialog.component';

@Component({
  selector: 'app-login-required-page',

  standalone: true,

  imports: [AuthDialogComponent],

  template: `
    <main class="login-gateway" aria-hidden="true"></main>

    <app-auth-dialog [open]="true" (closed)="handleClosed()" />
  `,

  styles: `
    :host {
      display: block;

      min-height: calc(100vh - 160px);
    }

    .login-gateway {
      min-height: calc(100vh - 160px);

      background: radial-gradient(circle at 50% 10%, rgba(124, 58, 237, 0.09), transparent 42%);
    }
  `,

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginRequiredPageComponent {
  private readonly route = inject(ActivatedRoute);

  private readonly router = inject(Router);

  protected readonly auth = inject(AuthStore);

  private readonly returnUrl = readSafeReturnUrl(
    this.route.snapshot.queryParamMap.get('returnUrl'),
  );

  constructor() {
    /**
     * Cho trường hợp user trực tiếp mở
     * /dang-nhap khi vẫn còn refresh cookie.
     */
    this.auth.initialize();

    /**
     * Login thành công:
     *
     * AuthDialog
     *   ↓
     * AuthStore authenticated
     *   ↓
     * tự quay lại URL ban đầu.
     */
    effect(() => {
      if (!this.auth.isAuthenticated()) {
        return;
      }

      void this.router.navigateByUrl(this.returnUrl, {
        replaceUrl: true,
      });
    });
  }

  protected handleClosed(): void {
    /**
     * Nếu dialog đóng sau login,
     * effect phía trên sẽ xử lý returnUrl.
     */
    if (this.auth.isAuthenticated()) {
      void this.router.navigateByUrl(this.returnUrl, {
        replaceUrl: true,
      });

      return;
    }

    /**
     * User chủ động đóng dialog
     * mà chưa đăng nhập.
     */
    void this.router.navigateByUrl('/', {
      replaceUrl: true,
    });
  }
}

function readSafeReturnUrl(value: string | null): string {
  const candidate = value?.trim() ?? '';

  /**
   * Chỉ chấp nhận internal URL.
   *
   * Không cho:
   *
   * //evil.com
   * https://evil.com
   */
  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return '/';
  }

  /**
   * Tránh login redirect loop.
   */
  if (candidate === '/dang-nhap' || candidate.startsWith('/dang-nhap?')) {
    return '/';
  }

  return candidate;
}
