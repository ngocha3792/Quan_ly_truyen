import {
    ChangeDetectionStrategy,
    Component,
    inject,
} from '@angular/core';

import {
    ActivatedRoute,
    RouterLink,
} from '@angular/router';

import {
    IconComponent,
} from '../../../../../shared/components/icon/icon.component';

type DeniedReason =
    | 'role'
    | 'permission';

@Component({
    selector:
        'app-access-denied-page',

    standalone: true,

    imports: [
        RouterLink,
        IconComponent,
    ],

    template: `
    <main class="denied-page">
      <section
        class="denied-card"
        aria-labelledby="access-denied-title"
      >
        <div class="icon-shell">
          <app-icon
            name="shield"
            [size]="34"
          />
        </div>

        <span class="status">
          403
        </span>

        <h1 id="access-denied-title">
          Bạn chưa có quyền truy cập
        </h1>

        @if (
          reason === 'role'
        ) {
          <p>
            Tài khoản hiện tại chưa có
            vai trò phù hợp để truy cập
            khu vực này.
          </p>

          <div class="actions">
            <a
              class="primary-button"
              routerLink="/dang-ky-tac-gia"
            >
              Đăng ký trở thành tác giả
            </a>

            <a
              class="secondary-button"
              routerLink="/"
            >
              Về trang chủ
            </a>
          </div>
        } @else {
          <p>
            Tài khoản của bạn chưa được
            cấp quyền cần thiết để sử dụng
            chức năng này.
          </p>

          <div class="actions">
            <a
              class="primary-button"
              routerLink="/tai-khoan"
            >
              Về tài khoản
            </a>

            <a
              class="secondary-button"
              routerLink="/"
            >
              Về trang chủ
            </a>
          </div>
        }
      </section>
    </main>
  `,

    styles: `
    :host {
      display: block;
    }

    .denied-page {
      min-height:
        calc(100vh - 150px);

      padding: 80px 20px;

      display: grid;

      place-items: center;
    }

    .denied-card {
      width: min(
        100%,
        520px
      );

      padding: 42px 34px;

      text-align: center;

      border:
        1px solid
        rgba(
          148,
          163,
          184,
          0.15
        );

      border-radius: 16px;

      background:
        rgba(
          15,
          23,
          42,
          0.66
        );

      box-shadow:
        0 30px 80px
        rgba(
          0,
          0,
          0,
          0.2
        );
    }

    .icon-shell {
      width: 72px;

      height: 72px;

      margin:
        0 auto
        20px;

      display: grid;

      place-items: center;

      border-radius: 50%;

      color: #c4b5fd;

      background:
        rgba(
          124,
          58,
          237,
          0.13
        );
    }

    .status {
      display: block;

      margin-bottom: 8px;

      color: #a78bfa;

      font-size: 13px;

      font-weight: 800;

      letter-spacing:
        0.12em;
    }

    h1 {
      margin:
        0 0
        14px;

      color: #f8fafc;

      font-size:
        clamp(
          24px,
          5vw,
          32px
        );

      line-height: 1.2;
    }

    p {
      max-width: 420px;

      margin:
        0 auto
        28px;

      color: #94a3b8;

      font-size: 14px;

      line-height: 1.7;
    }

    .actions {
      display: flex;

      justify-content: center;

      flex-wrap: wrap;

      gap: 10px;
    }

    .primary-button,
    .secondary-button {
      min-height: 44px;

      padding:
        0 18px;

      display:
        inline-flex;

      align-items: center;

      justify-content: center;

      border-radius: 8px;

      font-size: 13.5px;

      font-weight: 700;

      text-decoration: none;

      transition:
        transform
          150ms ease,
        border-color
          150ms ease;
    }

    .primary-button {
      color: #fff;

      background:
        linear-gradient(
          135deg,
          #743cdd,
          #a451eb
        );
    }

    .secondary-button {
      border:
        1px solid
        rgba(
          148,
          163,
          184,
          0.22
        );

      color: #cbd5e1;

      background:
        rgba(
          15,
          23,
          42,
          0.3
        );
    }

    .primary-button:hover,
    .secondary-button:hover {
      transform:
        translateY(-1px);
    }

    @media (
      max-width: 520px
    ) {
      .denied-page {
        padding:
          50px 16px;
      }

      .denied-card {
        padding:
          34px 20px;
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

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class AccessDeniedPageComponent {
    private readonly route =
        inject(ActivatedRoute);

    protected readonly reason:
        DeniedReason =
        readDeniedReason(
            this.route.snapshot
                .queryParamMap
                .get('reason'),
        );
}

function readDeniedReason(
    value: string | null,
): DeniedReason {
    return value === 'role'
        ? 'role'
        : 'permission';
}