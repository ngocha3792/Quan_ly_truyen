import {
    ChangeDetectionStrategy,
    Component,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
    selector:
        'app-security-tips-card',

    standalone: true,

    imports: [
        RouterLink,
        IconComponent,
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <aside class="tips-card">
      <header>
        <app-icon
          name="shield"
          [size]="19"
        />

        <h2>Mẹo bảo mật</h2>
      </header>

      <div class="tip">
        <span class="tip-icon green">
          <app-icon
            name="logout"
            [size]="15"
          />
        </span>

        <div>
          <strong>
            Đăng xuất khỏi thiết bị lạ
          </strong>

          <p>
            Thu hồi phiên nếu phát hiện thiết bị
            hoặc vị trí không quen thuộc.
          </p>
        </div>
      </div>

      <div class="tip">
        <span class="tip-icon green">
          <app-icon
            name="shield"
            [size]="15"
          />
        </span>

        <div>
          <strong>
            Kiểm tra phiên định kỳ
          </strong>

          <p>
            Xem lại danh sách thiết bị để phát
            hiện hoạt động bất thường.
          </p>
        </div>
      </div>

      <div class="tip">
        <span class="tip-icon yellow">
          <app-icon
            name="lock"
            [size]="15"
          />
        </span>

        <div>
          <strong>
            Bật xác thực hai lớp
          </strong>

          <p>
            Thêm một lớp bảo vệ khi mật khẩu
            tài khoản bị lộ.
          </p>
        </div>
      </div>

      <a
        routerLink="/tai-khoan/bao-mat"
      >
        Quản lý bảo mật
      </a>
    </aside>
  `,

    styles: `
    .tips-card {
      padding: 19px;
      border: 1px solid var(--border);
      border-radius: 13px;
      background:
        linear-gradient(
          145deg,
          rgba(17, 25, 44, .98),
          rgba(10, 16, 31, .98)
        );
    }

    header {
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      gap: 9px;
      color: #bc7efa;
    }

    h2 {
      margin: 0;
      color: #ebe9ef;
      font-size: 12px;
    }

    .tip {
      margin-top: 16px;
      display: grid;
      grid-template-columns:
        auto minmax(0, 1fr);
      gap: 10px;
    }

    .tip-icon {
      width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      border-radius: 7px;
    }

    .tip-icon.green {
      color: #57d977;
      background:
        rgba(34, 197, 94, .12);
    }

    .tip-icon.yellow {
      color: #f0b84d;
      background:
        rgba(245, 158, 11, .12);
    }

    .tip strong {
      color: #d7d5dd;
      font-size: 9px;
    }

    .tip p {
      margin: 5px 0 0;
      color: #6f798e;
      font-size: 8px;
      line-height: 1.55;
    }

    a {
      min-height: 36px;
      margin-top: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #7543c7;
      border-radius: 7px;
      color: #bc80fa;
      font-size: 9px;
      font-weight: 750;
      text-decoration: none;
    }
  `,
})
export class SecurityTipsCardComponent { }