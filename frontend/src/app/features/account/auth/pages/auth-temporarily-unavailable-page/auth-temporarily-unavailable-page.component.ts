import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { finalize } from 'rxjs';

import { AuthStore } from '../../../../../core/auth/auth.store';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-auth-temporarily-unavailable-page',

  standalone: true,

  imports: [RouterLink, IconComponent],

  template: `
    <main class="unavailable-page">
      <section class="unavailable-card" aria-labelledby="auth-unavailable-title">
        <div class="icon-shell">
          <app-icon name="alert-triangle" [size]="34" />
        </div>

        <span class="status"> TẠM THỜI GIÁN ĐOẠN </span>

        <h1 id="auth-unavailable-title">Chưa thể xác minh phiên đăng nhập</h1>

        <p>
          Hệ thống chưa thể kiểm tra phiên đăng nhập của bạn do kết nối hoặc backend đang tạm thời
          không khả dụng. Phiên của bạn chưa bị coi là đã đăng xuất.
        </p>

        @if (auth.error()) {
          <p class="error-message" role="status">
            {{ auth.error() }}
          </p>
        }

        <div class="actions">
          <button type="button" class="primary-button" [disabled]="retrying()" (click)="retry()">
            <app-icon name="rotate-ccw" [size]="16" />

            {{ retrying() ? 'Đang thử lại...' : 'Thử xác minh lại' }}
          </button>

          <a class="secondary-button" routerLink="/"> Về trang chủ </a>
        </div>
      </section>
    </main>
  `,

  styles: `
    :host {
      display: block;

      min-height: 100vh;

      background: #020617;
    }

    .unavailable-page {
      min-height: 100vh;

      padding: 80px 20px;

      display: grid;

      place-items: center;
    }

    .unavailable-card {
      width: min(100%, 560px);

      padding: 42px 34px;

      text-align: center;

      border: 1px solid rgba(148, 163, 184, 0.15);

      border-radius: 16px;

      background: rgba(15, 23, 42, 0.82);

      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.25);
    }

    .icon-shell {
      width: 72px;

      height: 72px;

      margin: 0 auto 20px;

      display: grid;

      place-items: center;

      border-radius: 50%;

      color: #fbbf24;

      background: rgba(245, 158, 11, 0.12);
    }

    .status {
      display: block;

      margin-bottom: 8px;

      color: #fbbf24;

      font-size: 12px;

      font-weight: 800;

      letter-spacing: 0.12em;
    }

    h1 {
      margin: 0 0 14px;

      color: #f8fafc;

      font-size: clamp(24px, 5vw, 32px);

      line-height: 1.2;
    }

    p {
      max-width: 460px;

      margin: 0 auto 20px;

      color: #94a3b8;

      font-size: 14px;

      line-height: 1.7;
    }

    .error-message {
      padding: 10px 12px;

      border: 1px solid rgba(248, 113, 113, 0.22);

      border-radius: 8px;

      color: #fca5a5;

      background: rgba(127, 29, 29, 0.16);
    }

    .actions {
      margin-top: 28px;

      display: flex;

      justify-content: center;

      flex-wrap: wrap;

      gap: 10px;
    }

    .primary-button,
    .secondary-button {
      min-height: 44px;

      padding: 0 18px;

      display: inline-flex;

      align-items: center;

      justify-content: center;

      gap: 8px;

      border-radius: 8px;

      font-size: 13.5px;

      font-weight: 700;

      text-decoration: none;

      transition:
        transform 150ms ease,
        border-color 150ms ease,
        opacity 150ms ease;
    }

    .primary-button {
      border: 0;

      color: #fff;

      background: linear-gradient(135deg, #743cdd, #a451eb);

      cursor: pointer;
    }

    .primary-button:disabled {
      opacity: 0.65;

      cursor: wait;
    }

    .secondary-button {
      border: 1px solid rgba(148, 163, 184, 0.22);

      color: #cbd5e1;

      background: rgba(15, 23, 42, 0.3);
    }

    .primary-button:not(:disabled):hover,
    .secondary-button:hover {
      transform: translateY(-1px);
    }

    @media (max-width: 520px) {
      .unavailable-page {
        padding: 50px 16px;
      }

      .unavailable-card {
        padding: 34px 20px;
      }

      .actions {
        display: grid;
      }

      .primary-button,
      .secondary-button {
        width: 100%;
      }
    }
  `,

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthTemporarilyUnavailablePageComponent {
  private readonly route = inject(ActivatedRoute);

  private readonly router = inject(Router);

  protected readonly auth = inject(AuthStore);

  protected readonly retrying = signal(false);

  private readonly returnUrl = readSafeReturnUrl(
    this.route.snapshot.queryParamMap.get('returnUrl'),
  );

  protected retry(): void {
    if (this.retrying()) {
      return;
    }

    this.retrying.set(true);

    this.auth
      .ensureInitialized()
      .pipe(
        finalize(() => {
          this.retrying.set(false);
        }),
      )
      .subscribe((result) => {
        if (result === 'authenticated') {
          void this.router.navigateByUrl(
            this.returnUrl,

            {
              replaceUrl: true,
            },
          );

          return;
        }

        if (result === 'anonymous') {
          void this.router.navigate(
            ['/dang-nhap'],

            {
              queryParams: {
                returnUrl: this.returnUrl,
              },

              replaceUrl: true,
            },
          );
        }

        /**
         * unavailable:
         *
         * ở nguyên page hiện tại để user
         * có thể retry lần nữa.
         */
      });
  }
}

function readSafeReturnUrl(value: string | null): string {
  const candidate = value?.trim() ?? '';

  /**
   * Chỉ internal URL.
   */
  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return '/';
  }

  /**
   * Tránh retry redirect loop.
   */
  if (
    candidate === '/tam-thoi-khong-the-xac-thuc' ||
    candidate.startsWith('/tam-thoi-khong-the-xac-thuc?')
  ) {
    return '/';
  }

  return candidate;
}
