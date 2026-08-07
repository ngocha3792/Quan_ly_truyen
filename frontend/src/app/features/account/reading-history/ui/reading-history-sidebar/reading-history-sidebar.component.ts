
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
    ContinueReadingItem,
    ReadingHistoryStatistics,
} from '../../domain/reading-history.models';
import { ReadingHistorySyncState } from '../../data-access/reading-history.store';

@Component({
    selector: 'app-reading-history-sidebar',
    standalone: true,
    imports: [
        RouterLink,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,

    template: `
    <aside class="sidebar">
      <section class="sidebar-card statistics-card">
        <header class="card-header">
          <svg viewBox="0 0 24 24">
            <path d="M4 18V10"></path>
            <path d="M10 18V5"></path>
            <path d="M16 18v-8"></path>
            <path d="M22 18V7"></path>
          </svg>

          <h2>Thống kê đọc</h2>
        </header>

        <div class="statistics-list">
          <article>
            <span class="stat-icon">
              <svg viewBox="0 0 24 24">
                <path
                  d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"
                ></path>

                <path d="M8 8h8"></path>
              </svg>
            </span>

            <p>Số truyện đã đọc</p>

            <strong>
              {{ statistics.storiesRead }}
            </strong>
          </article>

          <article>
            <span class="stat-icon">
              <svg viewBox="0 0 24 24">
                <path d="M5 6h14"></path>
                <path d="M5 12h14"></path>
                <path d="M5 18h14"></path>
                <path d="M2 6h.01"></path>
                <path d="M2 12h.01"></path>
                <path d="M2 18h.01"></path>
              </svg>
            </span>

            <p>Tổng chương đã đọc</p>

            <strong>
              {{ statistics.chaptersRead }}
            </strong>
          </article>

          <article>
            <span class="stat-icon">
              <svg viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                ></circle>

                <path d="M12 7v5l3 2"></path>
              </svg>
            </span>

            <p>Thời gian đọc tuần này</p>

            <strong>
              {{ statistics.weeklyReadingTime }}
            </strong>
          </article>

          <article>
            <span class="stat-icon">
              <svg viewBox="0 0 24 24">
                <path
                  d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4V4Z"
                ></path>
              </svg>
            </span>

            <p>Truyện đang theo dõi</p>

            <strong>
              {{ statistics.followedStories }}
            </strong>
          </article>
        </div>
      </section>

      <section class="sidebar-card continue-card">
        <header class="card-header">
          <svg viewBox="0 0 24 24">
            <path d="m8 5 11 7-11 7V5Z"></path>
          </svg>

          <h2>Tiếp tục đọc</h2>
        </header>

        <div class="continue-list">
          @for (
            item of continueReading;
            track item.id
          ) {
            <a
              class="continue-item"
              [routerLink]="[
                '/truyen',
                item.storySlug,
                'chuong',
                item.chapterNumber
              ]"
            >
              <span
                class="mini-cover"
                [attr.data-tone]="item.coverTone"
              >
                {{ item.coverInitials }}
              </span>

              <span class="continue-information">
                <strong>
                  {{ item.title }}
                </strong>

                <small>
                  Chương {{ item.chapterNumber }}
                </small>

                <span class="mini-progress">
                  <span
                    [style.width.%]="item.progress"
                  ></span>
                </span>
              </span>

              <strong class="progress-value">
                {{ item.progress }}%
              </strong>
            </a>
          } @empty {
            <p class="continue-empty">
              Chưa có truyện đang đọc.
            </p>
          }
        </div>
      </section>

      <section class="sidebar-card actions-card">
        <button
          class="action-button action-button--danger"
          type="button"
          (click)="clearHistory.emit()"
        >
          <span class="action-icon">
            <svg viewBox="0 0 24 24">
              <path d="M3 6h18"></path>
              <path d="M8 6V3h8v3"></path>
              <path d="m19 6-1 15H6L5 6"></path>
              <path d="M10 11v5"></path>
              <path d="M14 11v5"></path>
            </svg>
          </span>

          <span>
            <strong>Xóa lịch sử</strong>
            <small>Xóa toàn bộ lịch sử đọc</small>
          </span>
        </button>

        <button
          class="action-button action-button--sync"
          type="button"
          (click)="syncDevices.emit()"
        >
          <span class="action-icon">
            <svg viewBox="0 0 24 24">
              <path d="M20 7h-5V2"></path>
              <path d="M4 17h5v5"></path>
              <path
                d="M19 5a9 9 0 0 0-14.5 2"
              ></path>
              <path
                d="M5 19a9 9 0 0 0 14.5-2"
              ></path>
            </svg>
          </span>

          <span>
            <strong>
              {{
                syncState === 'success'
                  ? 'Đã đồng bộ'
                  : 'Đồng bộ thiết bị'
              }}
            </strong>

            <small>
              {{
                syncState === 'success'
                  ? 'Dữ liệu đã được cập nhật'
                  : 'Đồng bộ tiến độ đọc'
              }}
            </small>
          </span>
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

    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 1.1rem 1.25rem .75rem;
    }

    .card-header svg {
      width: 19px;
      height: 19px;
      color: #b779f6;
    }

    .card-header h2 {
      margin: 0;
      color: #e9e7ee;
      font-size: 1.05rem;
      font-weight: 700;
    }

    .statistics-list {
      padding: 0 1.25rem 1rem;
    }

    .statistics-list article {
      display: grid;
      min-height: 52px;
      grid-template-columns:
        40px
        minmax(0, 1fr)
        auto;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid var(--border);
    }

    .statistics-list article:last-child {
      border-bottom: 0;
    }

    .stat-icon {
      display: grid;
      width: 36px;
      height: 36px;
      place-items: center;
      border-radius: 8px;
      background: rgba(125, 61, 204, 0.15);
      color: var(--primary-soft);
    }

    .stat-icon svg {
      width: 19px;
      height: 19px;
    }

    .statistics-list p {
      margin: 0;
      color: var(--text-secondary);
      font-size: 12.5px;
    }

    .statistics-list strong {
      color: var(--text-strong);
      font-size: 13.5px;
      font-weight: 650;
      text-align: right;
    }

    .continue-list {
      padding: 0 1.25rem 1rem;
    }

    .continue-item {
      display: grid;
      min-height: 66px;
      grid-template-columns:
        44px
        minmax(0, 1fr)
        36px;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid var(--border);
      color: inherit;
      text-decoration: none;
    }

    .continue-item:last-child {
      border-bottom: 0;
    }

    .continue-item:hover {
      background: rgba(140, 77, 232, 0.06);
    }

    .mini-cover {
      display: grid;
      width: 40px;
      height: 50px;
      place-items: center;
      border-radius: 6px;
      background: linear-gradient(145deg, #2563eb, #10162b);
      color: #ffffff;
      font-size: 14px;
      font-weight: 850;
    }

    .mini-cover[data-tone='orange'] {
      background: linear-gradient(145deg, #f97316, #24110b);
    }

    .mini-cover[data-tone='silver'] {
      background: linear-gradient(145deg, #d7e1ed, #273143);
      color: #111827;
    }

    .mini-cover[data-tone='violet'] {
      background: linear-gradient(145deg, #9333ea, #221137);
    }

    .mini-cover[data-tone='gold'] {
      background: linear-gradient(145deg, #d4a72c, #32240b);
    }

    .mini-cover[data-tone='cyan'] {
      background: linear-gradient(145deg, #0891b2, #102536);
    }

    .continue-information {
      display: grid;
      min-width: 0;
      gap: 3px;
    }

    .continue-information > strong {
      overflow: hidden;
      color: var(--text-strong);
      font-size: 13px;
      font-weight: 650;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .continue-information small {
      color: var(--text-muted);
      font-size: 11.5px;
    }

    .mini-progress {
      height: 5px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(105, 116, 145, 0.18);
    }

    .mini-progress span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #7c3aed, var(--primary-soft));
    }

    .progress-value {
      color: var(--text-strong);
      font-size: 12px;
      font-weight: 650;
      text-align: right;
    }

    .continue-empty {
      margin: 15px 0;
      color: var(--text-muted);
      font-size: 12.5px;
      text-align: center;
    }

    .actions-card {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 10px;
    }

    .action-button {
      display: grid;
      min-height: 56px;
      grid-template-columns: 34px minmax(0, 1fr);
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: rgba(5, 10, 21, 0.4);
      color: var(--text-secondary);
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }

    .action-button:hover {
      background: rgba(140, 77, 232, 0.12);
      border-color: rgba(192, 132, 252, 0.35);
    }

    .action-icon {
      display: grid;
      width: 32px;
      height: 32px;
      place-items: center;
      border-radius: 50%;
    }

    .action-button--danger .action-icon {
      background: rgba(239, 68, 68, 0.15);
      color: #fb7185;
    }

    .action-button--sync .action-icon {
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
    }

    .action-icon svg {
      width: 17px;
      height: 17px;
    }

    .action-button strong,
    .action-button small {
      display: block;
    }

    .action-button strong {
      margin-bottom: 2px;
      color: var(--text-strong);
      font-size: 12.5px;
      font-weight: 650;
    }

    .action-button small {
      color: var(--text-muted);
      font-size: 11px;
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

      .actions-card {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 590px) {
      .sidebar {
        grid-template-columns: 1fr;
      }

      .actions-card {
        grid-column: auto;
      }
    }
  `],
})
export class ReadingHistorySidebarComponent {
    @Input({ required: true })
    statistics!: ReadingHistoryStatistics;

    @Input({ required: true })
    continueReading:
        readonly ContinueReadingItem[] = [];

    @Input()
    syncState: ReadingHistorySyncState =
        'idle';

    @Output()
    readonly clearHistory =
        new EventEmitter<void>();

    @Output()
    readonly syncDevices =
        new EventEmitter<void>();
}