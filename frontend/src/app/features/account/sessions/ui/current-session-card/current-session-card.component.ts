import { DatePipe } from '@angular/common';

import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

import { AccountSessionViewModel } from '../../domain/account-session.models';

import { SessionDeviceIconComponent } from '../session-device-icon/session-device-icon.component';

@Component({
    selector:
        'app-current-session-card',

    standalone: true,

    imports: [
        DatePipe,
        IconComponent,
        SessionDeviceIconComponent,
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <section class="current-card">
      <header>
        <h2>Thiết bị hiện tại</h2>

        <span class="protected-badge">
          <app-icon
            name="shield"
            [size]="13"
          />

          Được bảo vệ
        </span>
      </header>

      <div class="current-content">
        <div class="device-info">
          <app-session-device-icon
            [browser]="session().browser"
            [label]="session().browserName"
          />

          <div>
            <div class="device-title">
              <strong>
                {{ session().title }}
              </strong>

              <span>
                Thiết bị hiện tại
              </span>
            </div>

            @if (session().trusted) {
              <span class="trusted-badge">
                Thiết bị tin cậy
              </span>
            }

            <p>
              {{ session().subtitle }}
            </p>

            <small>
              {{ session().location }}

              @if (
                session().ipAddress
              ) {
                •
                {{ session().ipAddress }}
              }
            </small>
          </div>
        </div>

        <div class="current-divider"></div>

        <div class="detail-column">
          <span>Đăng nhập lúc</span>

          <strong>
            {{
              session().createdAt
                | date:
                    'HH:mm, dd/MM/yyyy'
            }}
          </strong>

          <small>
            Phiên được tạo trên thiết bị này
          </small>
        </div>

        <div class="current-divider"></div>

        <div class="detail-column status">
          <span>Trạng thái</span>

          <strong>
            <app-icon
              name="shield"
              [size]="14"
            />

            {{ session().statusLabel }}
          </strong>

          <small>
            Phiên này đang hoạt động
          </small>
        </div>
      </div>
    </section>
  `,

    styles: `
    .current-card {
      padding: 18px;
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
      margin-bottom: 17px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    h2 {
      margin: 0;
      color: #e9e7ed;
      font-size: 13px;
    }

    .protected-badge {
      padding: 6px 9px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border-radius: 6px;
      color: #bb82f6;
      font-size: 9px;
      background:
        rgba(124, 58, 237, .15);
    }

    .current-content {
      display: grid;
      grid-template-columns:
        minmax(320px, 1.5fr)
        auto
        minmax(170px, .7fr)
        auto
        minmax(170px, .7fr);
      align-items: center;
      gap: 18px;
    }

    .device-info {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .device-info > div {
      min-width: 0;
    }

    .device-title {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .device-title strong {
      color: #f0eef4;
      font-size: 12px;
    }

    .device-title span,
    .trusted-badge {
      padding: 5px 8px;
      border-radius: 5px;
      font-size: 8px;
      font-weight: 750;
    }

    .device-title span {
      color: #bd82f8;
      background:
        rgba(125, 61, 204, .17);
    }

    .trusted-badge {
      width: max-content;
      margin-top: 6px;
      display: block;
      color: #56d776;
      background:
        rgba(34, 197, 94, .13);
    }

    p,
    small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    p {
      margin: 7px 0 4px;
      color: #858fa3;
      font-size: 9px;
    }

    small {
      color: #687287;
      font-size: 9px;
    }

    .current-divider {
      width: 1px;
      height: 70px;
      background: var(--border);
    }

    .detail-column {
      min-width: 0;
      display: grid;
      gap: 7px;
    }

    .detail-column > span {
      color: #8992a5;
      font-size: 9px;
    }

    .detail-column strong {
      color: #ebe9ef;
      font-size: 11px;
    }

    .detail-column.status strong {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #56d875;
    }

    @media (max-width: 930px) {
      .current-content {
        grid-template-columns: 1fr 1fr;
      }

      .device-info {
        grid-column: 1 / -1;
      }

      .current-divider {
        display: none;
      }
    }

    @media (max-width: 560px) {
      .current-content {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class CurrentSessionCardComponent {
    readonly session =
        input.required<AccountSessionViewModel>();
}