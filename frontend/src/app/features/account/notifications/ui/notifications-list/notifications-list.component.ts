import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { UserNotification } from '../../domain/notifications.models';

@Component({
  selector: 'app-notifications-list',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="notification-list">
      @for (notification of notifications; track notification.id) {
        <article class="notification-row" [class.notification-row--unread]="!notification.isRead">
          <button
            class="read-indicator"
            type="button"
            [attr.aria-label]="notification.isRead ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'"
            (click)="readToggle.emit(notification.id)"
          >
            <span></span>
          </button>

          <span class="notification-icon" [attr.data-type]="notification.type">
            @switch (notification.type) {
              @case ('chapter') {
                <svg viewBox="0 0 24 24">
                  <path
                    d="M3.5 5.5A2.5 2.5 0 0 1 6 3h4a2 2 0 0 1 2 2v15a3 3 0 0 0-3-3H3.5V5.5Z"
                  ></path>

                  <path
                    d="M20.5 5.5A2.5 2.5 0 0 0 18 3h-4a2 2 0 0 0-2 2v15a3 3 0 0 1 3-3h5.5V5.5Z"
                  ></path>
                </svg>
              }

              @case ('comment') {
                <svg viewBox="0 0 24 24">
                  <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"></path>

                  <path d="M8 9h8"></path>
                  <path d="M8 13h5"></path>
                </svg>
              }

              @case ('author') {
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="8" r="3"></circle>

                  <path d="M5 20c.5-4 2.8-6 7-6s6.5 2 7 6"></path>
                </svg>
              }

              @case ('promotion') {
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="8" width="18" height="13" rx="2"></rect>

                  <path d="M12 8v13"></path>
                  <path d="M3 12h18"></path>

                  <path d="M12 8H8.5A2.5 2.5 0 1 1 11 5.5L12 8Z"></path>

                  <path d="M12 8h3.5A2.5 2.5 0 1 0 13 5.5L12 8Z"></path>
                </svg>
              }

              @case ('security') {
                <svg viewBox="0 0 24 24">
                  <path
                    d="M12 3 4.5 6v5.4c0 4.6 3 7.9 7.5 9.6 4.5-1.7 7.5-5 7.5-9.6V6L12 3Z"
                  ></path>

                  <path d="m9 12 2 2 4-4"></path>
                </svg>
              }

              @case ('following') {
                <svg viewBox="0 0 24 24">
                  <path
                    d="M3.5 5.5A2.5 2.5 0 0 1 6 3h4a2 2 0 0 1 2 2v15a3 3 0 0 0-3-3H3.5V5.5Z"
                  ></path>

                  <path
                    d="M20.5 5.5A2.5 2.5 0 0 0 18 3h-4a2 2 0 0 0-2 2v15a3 3 0 0 1 3-3h5.5V5.5Z"
                  ></path>
                </svg>
              }

              @case ('community') {
                <svg viewBox="0 0 24 24">
                  <path d="m3 11 14-6v14L3 13v-2Z"></path>

                  <path d="M7 14v5"></path>
                </svg>
              }

              @default {
                <svg viewBox="0 0 24 24">
                  <path
                    d="M12 21s-7-4.4-7-11a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 6.6-7 11-7 11Z"
                  ></path>
                </svg>
              }
            }
          </span>

          <a class="notification-content" [routerLink]="notification.route">
            <strong>
              {{ notification.title }}
            </strong>

            <p>
              {{ notification.message }}
            </p>
          </a>

          @if (!notification.isRead) {
            <span class="new-badge"> Mới </span>
          }

          <time>
            {{ notification.createdAt }}
          </time>

          <span class="category-tag" [attr.data-category]="notification.category">
            {{ notification.tag }}
          </span>

          <button
            class="save-button"
            type="button"
            [class.save-button--active]="notification.isSaved"
            [attr.aria-label]="notification.isSaved ? 'Bỏ lưu thông báo' : 'Lưu thông báo'"
            (click)="savedToggle.emit(notification.id)"
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4V4Z"></path>
            </svg>
          </button>
        </article>
      } @empty {
        <app-empty-state
          class="notification-empty"
          icon="bell"
          [iconSize]="32"
          title="Không có thông báo"
          description="Không tìm thấy thông báo phù hợp với bộ lọc hiện tại."
        />
      }
    </section>
  `,

  styles: [
    `
      :host {
        display: block;
      }

      .notification-list {
        overflow: hidden;
      }

      .notification-row {
        display: grid;
        min-height: 90px;
        grid-template-columns:
          28px
          52px
          minmax(260px, 1.4fr)
          76px
          125px
          145px
          44px;
        align-items: center;
        gap: 18px;
        padding: 16px 24px;
        border-bottom: 1px solid var(--border);
        transition: background-color 140ms ease;
      }

      .notification-row:last-child {
        border-bottom: 0;
      }

      .notification-row:hover {
        background: rgba(140, 77, 232, 0.08);
      }

      .notification-row--unread {
        background: linear-gradient(
          90deg,
          rgba(140, 77, 232, 0.1),
          rgba(18, 25, 45, 0.4),
          transparent
        );
      }

      .read-indicator {
        grid-column: 1;
        display: grid;
        width: 28px;
        height: 36px;
        place-items: center;
        border: 0;
        background: transparent;
        cursor: pointer;
      }

      .read-indicator span {
        width: 11px;
        height: 11px;
        border: 1px solid rgba(139, 151, 190, 0.28);
        border-radius: 50%;
        background: transparent;
      }

      .notification-row--unread .read-indicator span {
        border-color: #a855f7;
        background: #a855f7;
        box-shadow: 0 0 11px rgba(168, 85, 247, 0.6);
      }

      .notification-icon {
        grid-column: 2;
        display: grid;
        width: 52px;
        height: 52px;
        place-items: center;
        border-radius: 50%;
        background: linear-gradient(145deg, #7c3aed, #4c1d95);
        color: #ffffff;
        box-shadow: 0 0 18px rgba(126, 34, 206, 0.22);
      }

      .notification-icon[data-type='comment'] {
        background: linear-gradient(145deg, #22c55e, #047857);
      }

      .notification-icon[data-type='author'] {
        background: linear-gradient(145deg, #eab308, #b45309);
      }

      .notification-icon[data-type='promotion'] {
        background: linear-gradient(145deg, #ec4899, #be185d);
      }

      .notification-icon[data-type='security'] {
        background: linear-gradient(145deg, #3b82f6, #1d4ed8);
      }

      .notification-icon[data-type='following'] {
        background: linear-gradient(145deg, #22d3ee, #0e7490);
      }

      .notification-icon[data-type='community'] {
        background: linear-gradient(145deg, #a855f7, #6d28d9);
      }

      .notification-icon[data-type='achievement'] {
        background: linear-gradient(145deg, #f43f5e, #be123c);
      }

      .notification-icon svg {
        width: 26px;
        height: 26px;
      }

      .notification-content {
        grid-column: 3;
        min-width: 0;
        color: inherit;
        text-decoration: none;
      }

      .notification-content strong {
        display: block;
        overflow: hidden;
        margin-bottom: 5px;
        color: var(--text-strong);
        font-size: 17px;
        font-weight: 700;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .notification-content p {
        overflow: hidden;
        margin: 0;
        color: var(--text-secondary);
        font-size: 14px;
        line-height: 1.4;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .new-badge {
        grid-column: 4;
        justify-self: center;
        display: inline-flex;
        min-height: 28px;
        align-items: center;
        justify-content: center;
        padding: 5px 14px;
        border: 1px solid rgba(216, 180, 254, 0.28);
        border-radius: 999px;
        background: rgba(126, 34, 206, 0.34);
        color: #e9d5ff;
        font-size: 13px;
        font-weight: 700;
      }

      time {
        grid-column: 5;
        color: var(--text-muted);
        font-size: 14px;
        white-space: nowrap;
        text-align: right;
      }

      .category-tag {
        grid-column: 6;
        justify-self: end;
        padding: 6px 14px;
        border: 1px solid rgba(168, 85, 247, 0.25);
        border-radius: 999px;
        background: rgba(126, 34, 206, 0.15);
        color: #b967ff;
        font-size: 13.5px;
        font-weight: 600;
        white-space: nowrap;
      }

      .category-tag[data-category='account'] {
        border-color: rgba(34, 197, 94, 0.25);
        background: rgba(22, 163, 74, 0.12);
        color: #4ade80;
      }

      .category-tag[data-category='system'] {
        border-color: rgba(14, 165, 233, 0.25);
        background: rgba(2, 132, 199, 0.12);
        color: #38bdf8;
      }

      .category-tag[data-category='promotion'] {
        border-color: rgba(234, 179, 8, 0.25);
        background: rgba(202, 138, 4, 0.12);
        color: #facc15;
      }

      .save-button {
        grid-column: 7;
        display: grid;
        width: 44px;
        height: 44px;
        place-items: center;
        border: 1px solid var(--border);
        border-radius: 9px;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        transition:
          background-color 0.2s ease,
          border-color 0.2s ease;
      }

      .save-button:hover,
      .save-button--active {
        border-color: rgba(192, 132, 252, 0.38);
        background: rgba(126, 34, 206, 0.15);
        color: #c084fc;
      }

      .save-button svg {
        width: 20px;
        height: 20px;
      }

      .notification-row svg {
        --empty-min-height: 380px;

        --empty-padding: 35px;

        --empty-icon-box-size: 64px;

        --empty-icon-background: rgba(126, 34, 206, 0.14);

        --empty-icon-color: #c084fc;

        --empty-title-color: var(--text-strong);

        --empty-title-size: 18px;

        --empty-description-color: var(--text-muted);

        --empty-description-size: 13px;
      }

      @media (max-width: 900px) {
        .notification-row {
          grid-template-columns:
            15px
            39px
            minmax(0, 1fr)
            70px
            31px;
        }

        .new-badge,
        .category-tag {
          display: none;
        }
      }

      @media (max-width: 580px) {
        .notification-row {
          grid-template-columns:
            12px
            36px
            minmax(0, 1fr)
            30px;
        }

        time {
          display: none;
        }
      }
    `,
  ],
})
export class NotificationsListComponent {
  @Input({ required: true })
  notifications: readonly UserNotification[] = [];

  @Output()
  readonly readToggle = new EventEmitter<string>();

  @Output()
  readonly savedToggle = new EventEmitter<string>();
}
