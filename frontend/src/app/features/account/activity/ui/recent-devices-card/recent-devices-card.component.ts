import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { RelativeTimePipe } from '../../../../../shared/pipes/relative-time.pipe';

import { RecentDeviceViewModel } from '../../domain/account-activity.models';

@Component({
    selector:
        'app-recent-devices-card',

    standalone: true,

    imports: [
        RouterLink,
        IconComponent,
        RelativeTimePipe,
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <aside class="devices-card">
      <header>
        <h2>Thiết bị gần đây</h2>

        <a routerLink="/tai-khoan/thiet-bi">
          Xem tất cả
        </a>
      </header>

      <div class="device-list">
        @for (
          device of devices();
          track device.id
        ) {
          <article class="device">
            <span class="device-icon">
              <app-icon
                [name]="
                  device.operatingSystem ===
                    'iPhone'
                    ? 'smartphone'
                    : 'monitor'
                "
                [size]="18"
              />
            </span>

            <div>
              <strong>
                {{ device.deviceName }}
              </strong>

              <small>
                {{ device.location }}

                @if (device.ipAddress) {
                  • {{ device.ipAddress }}
                }
              </small>
            </div>

            @if (device.current) {
              <span class="current-badge">
                Hiện tại
              </span>
            } @else {
              <time>
                {{
                  device.lastUsedAt
                    | relativeTime
                }}
              </time>
            }
          </article>
        } @empty {
          <p class="empty">
            Chưa có dữ liệu thiết bị.
          </p>
        }
      </div>
    </aside>
  `,

    styles: `
    .devices-card {
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
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    h2 {
      margin: 0;
      color: #ebe9ef;
      font-size: 12px;
    }

    header a {
      color: #b776f4;
      font-size: 8px;
      text-decoration: none;
    }

    .device-list {
      display: grid;
    }

    .device {
      min-height: 59px;
      display: grid;
      grid-template-columns:
        auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      border-bottom:
        1px solid var(--border);
    }

    .device:last-child {
      border-bottom: 0;
    }

    .device-icon {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border-radius: 7px;
      color: #80aaff;
      background:
        rgba(37, 99, 235, .15);
    }

    .device > div {
      min-width: 0;
      display: grid;
      gap: 4px;
    }

    .device strong,
    .device small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .device strong {
      color: #d8d5de;
      font-size: 9px;
    }

    .device small {
      color: #677186;
      font-size: 7px;
    }

    time {
      color: #818b9e;
      font-size: 8px;
      white-space: nowrap;
    }

    .current-badge {
      padding: 4px 7px;
      border-radius: 5px;
      color: #55d875;
      font-size: 7px;
      background:
        rgba(34, 197, 94, .12);
    }

    .empty {
      margin: 0;
      color: #707a8e;
      font-size: 9px;
    }
  `,
})
export class RecentDevicesCardComponent {
    readonly devices =
        input.required<
            readonly RecentDeviceViewModel[]
        >();
}