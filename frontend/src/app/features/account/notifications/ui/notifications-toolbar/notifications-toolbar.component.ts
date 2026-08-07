
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';

import { NotificationCategory } from '../../domain/notifications.models';

@Component({
    selector: 'app-notifications-toolbar',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,

    template: `
    <section class="toolbar">
      <label class="search-box">
        <svg viewBox="0 0 24 24">
          <circle
            cx="11"
            cy="11"
            r="7"
          ></circle>

          <path d="m16 16 5 5"></path>
        </svg>

        <input
          type="search"
          [value]="query"
          placeholder="Tìm trong thông báo..."
          (input)="handleQuery($event)"
        >
      </label>

      <div class="category-list">
        <button
          type="button"
          [class.active]="category === 'all'"
          (click)="categoryChange.emit('all')"
        >
          Tất cả
        </button>

        <button
          type="button"
          [class.active]="category === 'unread'"
          (click)="categoryChange.emit('unread')"
        >
          Chưa đọc

          @if (unreadCount > 0) {
            <span>{{ unreadCount }}</span>
          }
        </button>

        <button
          type="button"
          [class.active]="category === 'system'"
          (click)="categoryChange.emit('system')"
        >
          Hệ thống
        </button>

        <button
          type="button"
          [class.active]="category === 'story'"
          (click)="categoryChange.emit('story')"
        >
          Cập nhật truyện
        </button>

        <button
          type="button"
          [class.active]="category === 'account'"
          (click)="categoryChange.emit('account')"
        >
          Tài khoản
        </button>
      </div>

      <button
        class="mark-read-button"
        type="button"
        (click)="markAllAsRead.emit()"
      >
        <svg viewBox="0 0 24 24">
          <path d="m5 12 4 4L19 6"></path>
        </svg>

        Đánh dấu tất cả đã đọc
      </button>

      <button
        class="filter-button"
        type="button"
        aria-label="Lọc thông báo"
      >
        <svg viewBox="0 0 24 24">
          <path d="M4 5h16"></path>
          <path d="M7 12h10"></path>
          <path d="M10 19h4"></path>
        </svg>

        Lọc
      </button>
    </section>
  `,

    styles: [`
    :host {
      display: block;
    }

    .toolbar {
      display: grid;
      grid-template-columns:
        280px
        minmax(320px, 1fr)
        auto
        auto;
      align-items: center;
      gap: 14px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
    }

    .search-box {
      display: flex;
      min-height: 44px;
      align-items: center;
      gap: 10px;
      padding: 0 16px;
      border: 1px solid var(--border);
      border-radius: 9px;
      background: rgba(8, 14, 28, 0.72);
    }

    .search-box svg {
      width: 19px;
      height: 19px;
      color: var(--text-muted);
    }

    .search-box input {
      width: 100%;
      height: 40px;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--text-strong);
      font: inherit;
      font-size: 14px;
    }

    .search-box input::placeholder {
      color: var(--text-muted);
    }

    .category-list {
      display: flex;
      min-width: 0;
      align-items: center;
      gap: 7px;
      overflow-x: auto;
    }

    .category-list button {
      display: inline-flex;
      min-height: 40px;
      flex: 0 0 auto;
      align-items: center;
      gap: 7px;
      padding: 7px 16px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: rgba(8, 14, 28, 0.45);
      color: var(--text-secondary);
      font: inherit;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }

    .category-list button.active {
      border-color: rgba(192, 132, 252, 0.38);
      background:
        linear-gradient(
          135deg,
          rgba(147, 51, 234, 0.85),
          rgba(109, 40, 217, 0.85)
        );
      color: #ffffff;
    }

    .category-list button span {
      display: grid;
      min-width: 20px;
      height: 20px;
      place-items: center;
      border-radius: 50%;
      background: #8b5cf6;
      color: #ffffff;
      font-size: 11.5px;
      font-weight: 700;
    }

    .mark-read-button,
    .filter-button {
      display: inline-flex;
      min-height: 42px;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 9px 18px;
      border: 1px solid rgba(192, 132, 252, 0.3);
      border-radius: 9px;
      background: rgba(76, 29, 149, 0.18);
      color: #ddd7ea;
      font: inherit;
      font-size: 13.5px;
      font-weight: 700;
      white-space: nowrap;
      cursor: pointer;
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }

    .mark-read-button:hover,
    .filter-button:hover {
      background: rgba(126, 34, 206, 0.28);
      color: #ffffff;
    }

    .toolbar svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .mark-read-button svg,
    .filter-button svg {
      width: 17px;
      height: 17px;
      color: #b967ff;
    }

    @media (max-width: 1050px) {
      .toolbar {
        grid-template-columns:
          minmax(230px, 1fr)
          175px
          66px;
      }

      .category-list {
        grid-column: 1 / -1;
        grid-row: 2;
      }
    }

    @media (max-width: 650px) {
      .toolbar {
        grid-template-columns: 1fr 55px;
      }

      .mark-read-button {
        grid-column: 1;
        grid-row: 2;
      }

      .filter-button {
        grid-column: 2;
        grid-row: 2;
      }

      .category-list {
        grid-row: 3;
      }
    }
  `],
})
export class NotificationsToolbarComponent {
    @Input()
    query = '';

    @Input()
    category: NotificationCategory = 'all';

    @Input()
    unreadCount = 0;

    @Output()
    readonly queryChange =
        new EventEmitter<string>();

    @Output()
    readonly categoryChange =
        new EventEmitter<NotificationCategory>();

    @Output()
    readonly markAllAsRead =
        new EventEmitter<void>();

    handleQuery(event: Event): void {
        const input =
            event.target as HTMLInputElement;

        this.queryChange.emit(input.value);
    }
}