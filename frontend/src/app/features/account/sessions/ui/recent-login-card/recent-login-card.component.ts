import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { RelativeTimePipe } from '../../../../../shared/pipes/relative-time.pipe';

import { LoginActivityViewModel } from '../../domain/account-session.models';

import { SessionDeviceIconComponent } from '../session-device-icon/session-device-icon.component';

@Component({
    selector:
        'app-recent-login-card',

    standalone: true,

    imports: [
        RouterLink,
        RelativeTimePipe,
        SessionDeviceIconComponent,
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <aside class="recent-card">
      <h2>Lịch sử đăng nhập gần đây</h2>

      <div class="activity-list">
        @for (
          activity of activities();
          track activity.id
        ) {
          <article class="activity">
            <app-session-device-icon
              [browser]="activity.browser"
              [label]="activity.title"
            />

            <div class="activity-copy">
              <strong>
                {{
                  activity.occurredAt
                    | relativeTime
                }}
              </strong>

              <span>{{ activity.title }}</span>

              <small>
                {{ activity.location }}

                @if (
                  activity.ipAddress
                ) {
                  • {{ activity.ipAddress }}
                }
              </small>
            </div>

            <span
              class="activity-status"
              [attr.data-status]="
                activity.status
              "
            >
              {{ activity.statusLabel }}
            </span>
          </article>
        }
      </div>

      <a
        routerLink="/tai-khoan/hoat-dong"
      >
        Xem tất cả lịch sử
      </a>
    </aside>
  `,

    styles: `
    .recent-card {
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

    h2 {
      margin: 0 0 17px;
      color: #e9e7ed;
      font-size: 12px;
    }

    .activity-list {
      display: grid;
      gap: 14px;
    }

    .activity {
      display: grid;
      grid-template-columns:
        auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 9px;
    }

    .activity app-session-device-icon {
      transform: scale(.72);
      transform-origin: center;
      margin: -5px;
    }

    .activity-copy {
      min-width: 0;
      display: grid;
      gap: 3px;
    }

    .activity-copy strong,
    .activity-copy span,
    .activity-copy small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .activity-copy strong {
      color: #dcd9e2;
      font-size: 9px;
    }

    .activity-copy span {
      color: #818b9f;
      font-size: 8px;
    }

    .activity-copy small {
      color: #626d82;
      font-size: 7px;
    }

    .activity-status {
      padding: 4px 6px;
      border-radius: 5px;
      color: #55d875;
      font-size: 7px;
      background:
        rgba(34, 197, 94, .11);
    }

    .activity-status[data-status='signed-out'] {
      color: #929bad;
      background:
        rgba(100, 116, 139, .12);
    }

    a {
      min-height: 35px;
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
export class RecentLoginCardComponent {
    readonly activities =
        input.required<
            readonly LoginActivityViewModel[]
        >();
}