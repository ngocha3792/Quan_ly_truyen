import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { RelativeTimePipe } from '../../../../../shared/pipes/relative-time.pipe';

import { AccountActivityViewModel } from '../../domain/account-activity.models';

@Component({
    selector:
        'app-suspicious-activity-card',

    standalone: true,

    imports: [
        RouterLink,
        IconComponent,
        RelativeTimePipe,
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    @if (activity()) {
      <aside class="warning-card">
        <header>
          <h2>
            Hoạt động bất thường
          </h2>

          <span>{{ count() }}</span>
        </header>

        <div class="warning-content">
          <span class="warning-icon">
            <app-icon
              name="alert-triangle"
              [size]="20"
            />
          </span>

          <div>
            <strong>
              {{ activity()?.title }}
            </strong>

            <p>
              {{
                activity()?.ipAddress ||
                'Không có địa chỉ IP'
              }}
              •
              {{ activity()?.location }}
            </p>
          </div>

          <time>
            {{
              activity()?.occurredAt
                | relativeTime
            }}
          </time>
        </div>

        <a routerLink="/tai-khoan/bao-mat">
          <app-icon
            name="shield"
            [size]="15"
          />

          Xem bảo mật
        </a>
      </aside>
    }
  `,

    styles: `
    .warning-card {
      padding: 18px;
      border: 1px solid
        rgba(244, 63, 94, .24);
      border-radius: 13px;
      background:
        linear-gradient(
          145deg,
          rgba(35, 20, 34, .96),
          rgba(18, 14, 27, .96)
        );
    }

    header {
      margin-bottom: 17px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    h2 {
      margin: 0;
      color: #f8fafc;
      font-size: 14.5px;
      font-weight: 700;
    }

    header > span {
      width: 22px;
      height: 22px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: #fb7185;
      font-size: 11px;
      font-weight: 600;
      background:
        rgba(190, 24, 93, .2);
    }

    .warning-content {
      display: grid;
      grid-template-columns:
        auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
    }

    .warning-icon {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: #fb7185;
      background:
        rgba(190, 24, 93, .16);
    }

    .warning-content > div {
      min-width: 0;
      display: grid;
      gap: 5px;
    }

    strong {
      color: #fda4b5;
      font-size: 13px;
      font-weight: 600;
    }

    p {
      margin: 0;
      overflow: hidden;
      color: #fca5b5;
      font-size: 11.5px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    time {
      color: #fca5b5;
      font-size: 11.5px;
      white-space: nowrap;
    }

    a {
      min-height: 42px;
      margin-top: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      border-radius: 6px;
      color: #fff;
      font-size: 13px;
      font-weight: 650;
      text-decoration: none;
      background:
        linear-gradient(
          135deg,
          #743bde,
          #a153eb
        );
    }
  `,
})
export class SuspiciousActivityCardComponent {
    readonly activity =
        input<
            AccountActivityViewModel | null
        >(null);

    readonly count = input(0);
}