
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';

import {
    NotificationActivity,
    NotificationSettingKey,
    NotificationSettings,
    NotificationStatistics,
} from '../../domain/notifications.models';

@Component({
    selector: 'app-notifications-sidebar',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,

    template: `
    <aside class="sidebar">
      <section class="sidebar-card overview-card">
        <header>
          <svg viewBox="0 0 24 24">
            <path d="M4 20V10"></path>
            <path d="M10 20V4"></path>
            <path d="M16 20v-7"></path>
            <path d="M22 20V7"></path>
          </svg>

          <h2>Tổng quan</h2>
        </header>

        <div class="overview-list">
          <article>
            <span>🔔</span>
            <p>Tổng thông báo</p>
            <strong>{{ statistics.total }}</strong>
          </article>

          <article>
            <span>◷</span>
            <p>Chưa đọc</p>
            <strong class="purple">
              {{ unreadCount }}
            </strong>
          </article>

          <article>
            <span>▱</span>
            <p>Đã lưu</p>
            <strong>{{ savedCount }}</strong>
          </article>

          <article>
            <span class="green">●</span>
            <p>Cập nhật hôm nay</p>
            <strong class="green">
              {{ statistics.receivedToday }}
            </strong>
          </article>
        </div>
      </section>

      <section class="sidebar-card settings-card">
        <header>
          <svg viewBox="0 0 24 24">
            <path
              d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
            ></path>

            <path d="M10 21h4"></path>
          </svg>

          <h2>Thiết lập thông báo</h2>
        </header>

        <div class="settings-list">
          <label>
            <span>
              <strong>Cập nhật chương mới</strong>
              <small>Thông báo khi có chương mới</small>
            </span>

            <input
              type="checkbox"
              [checked]="settings.newChapters"
              (change)="
                settingToggle.emit('newChapters')
              "
            >

            <span class="toggle"></span>
          </label>

          <label>
            <span>
              <strong>Bình luận &amp; phản hồi</strong>
              <small>
                Thông báo về bình luận và phản hồi
              </small>
            </span>

            <input
              type="checkbox"
              [checked]="settings.comments"
              (change)="
                settingToggle.emit('comments')
              "
            >

            <span class="toggle"></span>
          </label>

          <label>
            <span>
              <strong>Thông báo hệ thống</strong>
              <small>
                Cập nhật hệ thống, bảo mật
              </small>
            </span>

            <input
              type="checkbox"
              [checked]="settings.system"
              (change)="
                settingToggle.emit('system')
              "
            >

            <span class="toggle"></span>
          </label>

          <label>
            <span>
              <strong>Ưu đãi &amp; sự kiện</strong>
              <small>
                Khuyến mãi và sự kiện đặc biệt
              </small>
            </span>

            <input
              type="checkbox"
              [checked]="settings.promotions"
              (change)="
                settingToggle.emit('promotions')
              "
            >

            <span class="toggle"></span>
          </label>
        </div>
      </section>

      <section class="sidebar-card activities-card">
        <header>
          <svg viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="9"
            ></circle>

            <path d="M12 7v5l3 2"></path>
          </svg>

          <h2>Hoạt động gần đây</h2>
        </header>

        <div class="activity-list">
          @for (
            activity of activities;
            track activity.id
          ) {
            <article>
              <span class="activity-dot"></span>

              <time>
                {{ activity.time }}
              </time>

              <p>
                {{ activity.description }}
              </p>
            </article>
          }
        </div>

        <button
          class="view-activity-button"
          type="button"
        >
          Xem tất cả hoạt động

          <svg viewBox="0 0 24 24">
            <path d="M5 12h14"></path>
            <path d="m13 6 6 6-6 6"></path>
          </svg>
        </button>
      </section>
    </aside>
  `,

    styles: [`
    :host {
      display: block;
    }

    .sidebar {
      display: grid;
      gap: 1.25rem;
    }

    .sidebar-card {
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 12px;
      background:
        linear-gradient(
          145deg,
          rgba(17, 25, 44, 0.98),
          rgba(10, 16, 31, 0.98)
        );
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.11);
    }

    header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 1.2rem 1.35rem .8rem;
    }

    header svg {
      width: 21px;
      height: 21px;
      color: #b779f6;
    }

    header h2 {
      margin: 0;
      color: #e9e7ee;
      font-size: 1.1rem;
      font-weight: 700;
    }

    .overview-list {
      padding: 0 1.35rem 1rem;
    }

    .overview-list article {
      display: grid;
      min-height: 54px;
      grid-template-columns: 26px 1fr auto;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid var(--border);
    }

    .overview-list article:last-child {
      border-bottom: 0;
    }

    .overview-list article > span {
      color: var(--text-secondary);
      font-size: 15px;
    }

    .overview-list p {
      margin: 0;
      color: var(--text-secondary);
      font-size: 13.5px;
    }

    .overview-list strong {
      color: var(--text-strong);
      font-size: 14.5px;
      font-weight: 700;
    }

    .overview-list .purple {
      color: #b967ff;
    }

    .overview-list .green {
      color: #22c55e;
    }

    .settings-list {
      padding: 0 1.35rem 1rem;
    }

    .settings-list label {
      position: relative;
      display: grid;
      min-height: 58px;
      grid-template-columns: 1fr 44px;
      align-items: center;
      gap: 14px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
    }

    .settings-list label:last-child {
      border-bottom: 0;
    }

    .settings-list label > span:first-child {
      display: grid;
      gap: 3px;
    }

    .settings-list strong {
      color: var(--text-strong);
      font-size: 14px;
      font-weight: 700;
    }

    .settings-list small {
      color: var(--text-muted);
      font-size: 12.5px;
    }

    .settings-list input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .toggle {
      position: relative;
      width: 40px;
      height: 22px;
      border-radius: 999px;
      background: #252d43;
      transition: background-color 150ms ease;
    }

    .toggle::before {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      content: "";
      border-radius: 50%;
      background: #9ca5ba;
      transition: transform 150ms ease;
    }

    .settings-list input:checked + .toggle {
      background:
        linear-gradient(
          90deg,
          #7c3aed,
          #a855f7
        );
    }

    .settings-list input:checked
      + .toggle::before {
      background: #ffffff;
      transform: translateX(18px);
    }

    .activity-list {
      position: relative;
      padding: 6px 1.35rem 10px 1.9rem;
    }

    .activity-list::before {
      position: absolute;
      top: 14px;
      bottom: 20px;
      left: 1.55rem;
      width: 2px;
      content: "";
      background: rgba(168, 85, 247, 0.28);
    }

    .activity-list article {
      position: relative;
      display: grid;
      min-height: 56px;
      grid-template-columns: 90px 1fr;
      align-items: start;
      gap: 12px;
      padding-left: 12px;
    }

    .activity-dot {
      position: absolute;
      top: 7px;
      left: -9px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #a855f7;
      box-shadow: 0 0 9px rgba(168, 85, 247, 0.55);
    }

    .activity-list time {
      color: var(--text-muted);
      font-size: 12.5px;
    }

    .activity-list p {
      margin: 0;
      color: var(--text-secondary);
      font-size: 13.5px;
      line-height: 1.45;
    }

    .view-activity-button {
      display: flex;
      min-height: 46px;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      border: 0;
      background: transparent;
      color: var(--primary-soft);
      font: inherit;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      transition: color 0.2s ease;
    }

    .view-activity-button:hover {
      color: #d8b4fe;
    }

    .view-activity-button svg {
      width: 15px;
      height: 15px;
    }

    .sidebar svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    @media (max-width: 900px) {
      .sidebar {
        grid-template-columns: repeat(2, 1fr);
      }

      .activities-card {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 580px) {
      .sidebar {
        grid-template-columns: 1fr;
      }

      .activities-card {
        grid-column: auto;
      }
    }
  `],
})
export class NotificationsSidebarComponent {
    @Input({ required: true })
    statistics!: NotificationStatistics;

    @Input({ required: true })
    settings!: NotificationSettings;

    @Input({ required: true })
    activities: readonly NotificationActivity[] =
        [];

    @Input()
    unreadCount = 0;

    @Input()
    savedCount = 0;

    @Output()
    readonly settingToggle =
        new EventEmitter<NotificationSettingKey>();
}