
import {
    ChangeDetectionStrategy,
    Component,
    Input,
} from '@angular/core';
import {
    RouterLink,
} from '@angular/router';

import {
    PublicationScheduleItem,
} from '../../domain/author-studio.models';
import {
    StudioIconComponent,
} from '../studio-icon/studio-icon.component';

@Component({
    selector: 'app-publication-schedule',
    standalone: true,

    imports: [
        RouterLink,
        StudioIconComponent,
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <section class="dashboard-card">
      <header>
        <h2>
          <app-studio-icon
            name="calendar"
            [size]="17"
          ></app-studio-icon>

          Lịch xuất bản tuần này
        </h2>

        <a
          routerLink="/author-studio/lich-xuat-ban"
        >
          Xem tất cả
        </a>
      </header>

      <div class="schedule-list">
        @for (
          item of items;
          track item.id
        ) {
          <article>
            <div class="schedule-date">
              <strong>{{ item.weekday }}</strong>
              <span>{{ item.date }}</span>
            </div>

            <img
              [src]="item.coverUrl"
              [alt]="item.storyTitle"
            >

            <div class="schedule-information">
              <strong>
                {{ item.storyTitle }}
              </strong>

              <span>
                {{ item.chapterTitle }}
              </span>
            </div>

            <time>{{ item.time }}</time>

            <span
              class="schedule-status"
              [attr.data-status]="
                item.status
              "
            >
              {{ item.statusLabel }}
            </span>
          </article>
        }
      </div>
    </section>
  `,

    styles: [`
    :host {
      display: block;
      min-width: 0;
      height: 100%;
    }

    .dashboard-card {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 340px;
      padding: 18px 20px 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background:
        linear-gradient(
          145deg,
          rgba(16, 22, 39, 0.95),
          rgba(10, 15, 28, 0.95)
        );
      box-shadow: 0 14px 35px rgba(0, 0, 0, 0.15);
    }

    header {
      display: flex;
      min-height: 32px;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      color: #f6f3fb;
      font-size: 1.1rem;
      font-weight: 700;
    }

    h2 app-studio-icon {
      color: #c8cfe0;
    }

    header a {
      color: #b967ff;
      font-size: 13px;
      font-weight: 650;
      text-decoration: none;
    }

    .schedule-list {
      margin-top: 12px;
    }

    article {
      display: grid;
      min-height: 66px;
      grid-template-columns:
        50px
        36px
        minmax(0, 1fr)
        45px
        80px;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--border);
    }

    article:last-child {
      border-bottom: 0;
    }

    .schedule-date {
      display: grid;
      justify-items: center;
      gap: 3px;
    }

    .schedule-date strong {
      color: var(--text-strong);
      font-size: 13px;
      font-weight: 700;
    }

    .schedule-date span {
      color: var(--text-muted);
      font-size: 11.5px;
    }

    article img {
      width: 34px;
      height: 46px;
      border-radius: 5px;
      object-fit: cover;
    }

    .schedule-information {
      display: grid;
      min-width: 0;
      gap: 4px;
    }

    .schedule-information strong,
    .schedule-information span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .schedule-information strong {
      color: var(--text-strong);
      font-size: 13.5px;
      font-weight: 650;
    }

    .schedule-information span {
      color: var(--text-secondary);
      font-size: 12px;
    }

    time {
      color: var(--text-muted);
      font-size: 12px;
      text-align: right;
    }

    .schedule-status {
      justify-self: end;
      padding: 4px 9px;
      border-radius: 999px;
      background: rgba(36, 99, 235, 0.12);
      color: #4f83ff;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }

    .schedule-status[data-status='published'] {
      background: rgba(22, 163, 74, 0.12);
      color: #4ade80;
    }

    .schedule-status[data-status='pending'] {
      background: rgba(217, 119, 6, 0.13);
      color: #f59e0b;
    }

    .schedule-status[data-status='draft'] {
      background: rgba(100, 116, 139, 0.15);
      color: #aab3c5;
    }

    @media (max-width: 480px) {
      article {
        grid-template-columns:
          38px 31px minmax(0, 1fr);
      }

      time,
      .schedule-status {
        display: none;
      }
    }
  `],
})
export class PublicationScheduleComponent {
    @Input({ required: true })
    items:
        readonly PublicationScheduleItem[] =
        [];
}