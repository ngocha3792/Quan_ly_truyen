import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { RelativeTimePipe } from '../../../../../../shared/pipes/relative-time.pipe';

import { LoginActivityViewModel } from '../../domain/account-session.models';

import { SessionDeviceIconComponent } from '../session-device-icon/session-device-icon.component';

@Component({
  selector: 'app-recent-login-card',

  standalone: true,

  imports: [RouterLink, RelativeTimePipe, SessionDeviceIconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <aside class="recent-card">
      <h2>Lịch sử đăng nhập gần đây</h2>

      <div class="activity-list">
        @for (activity of activities(); track activity.id) {
          <article class="activity">
            <app-session-device-icon [browser]="activity.browser" [label]="activity.title" />

            <div class="activity-copy">
              <strong>
                {{ activity.occurredAt | relativeTime }}
              </strong>

              <span>{{ activity.title }}</span>

              <small>
                {{ activity.location }}

                @if (activity.ipAddress) {
                  • {{ activity.ipAddress }}
                }
              </small>
            </div>

            <span class="activity-status" [attr.data-status]="activity.status">
              {{ activity.statusLabel }}
            </span>
          </article>
        }
      </div>

      <a routerLink="/tai-khoan/hoat-dong"> Xem tất cả lịch sử </a>
    </aside>
  `,

  styles: `
    .recent-card {
      padding: 19px;
      border: 1px solid var(--border);
      border-radius: 13px;
      background: linear-gradient(145deg, rgba(17, 25, 44, 0.98), rgba(10, 16, 31, 0.98));
    }

    h2 {
      margin: 0 0 17px;
      color: #f8fafc;
      font-size: 14.5px;
      font-weight: 700;
    }

    .activity-list {
      display: grid;
      gap: 14px;
    }

    .activity {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
    }

    .activity app-session-device-icon {
      transform: scale(0.85);
      transform-origin: center;
      margin: -2px;
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
      color: #f8fafc;
      font-size: 13px;
      font-weight: 600;
    }

    .activity-copy span {
      color: #cbd5e1;
      font-size: 12px;
    }

    .activity-copy small {
      color: #94a3b8;
      font-size: 11px;
    }

    .activity-status {
      padding: 4px 8px;
      border-radius: 5px;
      color: #4ade80;
      font-size: 11px;
      font-weight: 600;
      background: rgba(34, 197, 94, 0.16);
    }

    .activity-status[data-status='signed-out'] {
      color: #94a3b8;
      background: rgba(100, 116, 139, 0.16);
    }

    a {
      min-height: 42px;
      margin-top: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #7543c7;
      border-radius: 7px;
      color: #c084fc;
      font-size: 13px;
      font-weight: 650;
      text-decoration: none;
    }
  `,
})
export class RecentLoginCardComponent {
  readonly activities = input.required<readonly LoginActivityViewModel[]>();
}
