
import {
    ChangeDetectionStrategy,
    Component,
    Input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
    LibraryQuickItem,
    LibraryReadingGoal,
    LibraryStatistics,
} from '../../domain/my-library.models';

@Component({
    selector: 'app-library-sidebar',
    standalone: true,
    imports: [
        RouterLink,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,

    template: `
    <aside class="library-sidebar">
      <section class="sidebar-card overview-card">
        <header>
          <h2>Tổng quan thư viện</h2>
        </header>

        <div class="overview-list">
          <article>
            <span class="overview-icon">
              <svg viewBox="0 0 24 24">
                <path
                  d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"
                ></path>

                <path d="M8 8h8"></path>
              </svg>
            </span>

            <p>Tổng truyện</p>

            <strong>
              {{ statistics.total }}
            </strong>
          </article>

          <article>
            <span class="overview-icon">
              <svg viewBox="0 0 24 24">
                <path
                  d="M3.5 5.5A2.5 2.5 0 0 1 6 3h4a2 2 0 0 1 2 2v15a3 3 0 0 0-3-3H3.5V5.5Z"
                ></path>

                <path
                  d="M20.5 5.5A2.5 2.5 0 0 0 18 3h-4a2 2 0 0 0-2 2v15a3 3 0 0 1 3-3h5.5V5.5Z"
                ></path>
              </svg>
            </span>

            <p>Đang đọc</p>

            <strong class="green">
              {{ statistics.reading }}
            </strong>
          </article>

          <article>
            <span class="overview-icon overview-icon--heart">
              <svg viewBox="0 0 24 24">
                <path
                  d="M12 21s-7-4.4-7-11a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 6.6-7 11-7 11Z"
                ></path>
              </svg>
            </span>

            <p>Yêu thích</p>

            <strong class="pink">
              {{ statistics.favorites }}
            </strong>
          </article>

          <article>
            <span class="overview-icon overview-icon--completed">
              <svg viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                ></circle>

                <path d="m8 12 2.5 2.5L16 9"></path>
              </svg>
            </span>

            <p>Hoàn thành</p>

            <strong class="yellow">
              {{ statistics.completed }}
            </strong>
          </article>
        </div>
      </section>

      <section class="sidebar-card quick-card">
        <header class="quick-header">
          <h2>Danh sách nhanh</h2>

          <a routerLink="/lich-su-doc">
            Xem tất cả
          </a>
        </header>

        <div class="quick-list">
          @for (
            item of quickItems;
            track item.id
          ) {
            <a
              class="quick-item"
              [routerLink]="[
                '/truyen',
                item.slug,
                'chuong',
                item.chapter
              ]"
            >
              <span
                class="mini-cover"
                [attr.data-tone]="item.coverTone"
              >
                {{ item.coverInitials }}
              </span>

              <span class="quick-information">
                <strong>
                  {{ item.title }}
                </strong>

                <small>
                  Chương {{ item.chapter }}
                </small>

                <span class="quick-progress">
                  <span
                    [style.width.%]="item.progress"
                  ></span>
                </span>
              </span>

              <strong class="quick-percentage">
                {{ item.progress }}%
              </strong>
            </a>
          }
        </div>
      </section>

      <section class="sidebar-card goal-card">
        <header>
          <svg viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="8"
            ></circle>

            <circle
              cx="12"
              cy="12"
              r="4"
            ></circle>

            <path d="m14.5 9.5 5-5"></path>
          </svg>

          <h2>Mục tiêu đọc</h2>
        </header>

        <div class="goal-content">
          <div class="goal-heading">
            <span>
              Đọc {{ goal.targetChapters }}
              chương mỗi tuần
            </span>

            <strong>
              {{ goal.completedChapters }}
              /
              {{ goal.targetChapters }}
              chương
            </strong>
          </div>

          <div class="goal-progress">
            <span
              [style.width.%]="
                getGoalProgress()
              "
            ></span>
          </div>

          <p>
            Còn {{ goal.remainingDays }}
            ngày để hoàn thành mục tiêu
          </p>

          <a routerLink="/tai-khoan/muc-tieu-doc">
            <svg viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="8"
              ></circle>

              <circle
                cx="12"
                cy="12"
                r="3"
              ></circle>
            </svg>

            Xem mục tiêu
          </a>
        </div>
      </section>
    </aside>
  `,

    styles: [`
    :host {
      display: block;
    }

    .library-sidebar {
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

    header h2 {
      margin: 0;
      color: #e9e7ee;
      font-size: 1.1rem;
      font-weight: 700;
    }

    header svg {
      width: 21px;
      height: 21px;
      color: #b779f6;
    }

    .overview-list {
      padding: 0 1.35rem 1rem;
    }

    .overview-list article {
      display: grid;
      min-height: 52px;
      grid-template-columns:
        36px
        minmax(0, 1fr)
        auto;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid var(--border);
    }

    .overview-list article:last-child {
      border-bottom: 0;
    }

    .overview-icon {
      display: grid;
      width: 32px;
      height: 32px;
      place-items: center;
      border-radius: 8px;
      background: rgba(126, 34, 206, 0.15);
      color: #b967ff;
    }

    .overview-icon--heart {
      background: rgba(190, 24, 93, 0.12);
      color: #f472b6;
    }

    .overview-icon--completed {
      background: rgba(202, 138, 4, 0.12);
      color: #facc15;
    }

    .overview-icon svg {
      width: 18px;
      height: 18px;
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

    .overview-list .green {
      color: #4ade80;
    }

    .overview-list .pink {
      color: #f472b6;
    }

    .overview-list .yellow {
      color: #facc15;
    }

    .quick-header {
      justify-content: space-between;
    }

    .quick-header a {
      color: var(--primary-soft);
      font-size: 12.5px;
      font-weight: 600;
      text-decoration: none;
    }

    .quick-list {
      padding: 0 1.35rem 1rem;
    }

    .quick-item {
      display: grid;
      min-height: 64px;
      grid-template-columns:
        44px
        minmax(0, 1fr)
        36px;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--border);
      color: inherit;
      text-decoration: none;
    }

    .quick-item:last-child {
      border-bottom: 0;
    }

    .mini-cover {
      display: grid;
      width: 42px;
      height: 52px;
      place-items: center;
      border-radius: 6px;
      background:
        linear-gradient(
          145deg,
          #2563eb,
          #10162b
        );
      color: #ffffff;
      font-size: 14px;
      font-weight: 850;
    }

    .mini-cover[data-tone='violet'] {
      background:
        linear-gradient(
          145deg,
          #9333ea,
          #23103d
        );
    }

    .mini-cover[data-tone='orange'] {
      background:
        linear-gradient(
          145deg,
          #f97316,
          #29120a
        );
    }

    .mini-cover[data-tone='gold'] {
      background:
        linear-gradient(
          145deg,
          #d4a72c,
          #34240a
        );
    }

    .mini-cover[data-tone='cyan'] {
      background:
        linear-gradient(
          145deg,
          #0891b2,
          #102536
        );
    }

    .mini-cover[data-tone='silver'] {
      background:
        linear-gradient(
          145deg,
          #cbd5e1,
          #273143
        );
      color: #111827;
    }

    .mini-cover[data-tone='crimson'] {
      background:
        linear-gradient(
          145deg,
          #e11d48,
          #2f1019
        );
    }

    .mini-cover[data-tone='indigo'] {
      background:
        linear-gradient(
          145deg,
          #6366f1,
          #171839
        );
    }

    .quick-information {
      display: grid;
      min-width: 0;
      gap: 4px;
    }

    .quick-information > strong {
      overflow: hidden;
      color: var(--text-strong);
      font-size: 13.5px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .quick-information small {
      color: var(--text-muted);
      font-size: 12px;
    }

    .quick-progress {
      height: 4px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(105, 116, 145, 0.22);
    }

    .quick-progress span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background:
        linear-gradient(
          90deg,
          #7c3aed,
          #b967ff
        );
    }

    .quick-percentage {
      color: var(--text-strong);
      font-size: 13px;
      font-weight: 650;
      text-align: right;
    }

    .goal-content {
      padding: 0 1.35rem 1.25rem;
    }

    .goal-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      color: var(--text-secondary);
      font-size: 13.5px;
    }

    .goal-heading strong {
      color: var(--text-strong);
      font-size: 13.5px;
      font-weight: 700;
    }

    .goal-progress {
      height: 9px;
      margin-top: 12px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(105, 116, 145, 0.22);
    }

    .goal-progress span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background:
        linear-gradient(
          90deg,
          #7c3aed,
          #b967ff
        );
      box-shadow: 0 0 10px rgba(168, 85, 247, 0.35);
    }

    .goal-content p {
      margin: 10px 0 14px;
      color: var(--text-muted);
      font-size: 12.5px;
    }

    .goal-content > a {
      display: flex;
      min-height: 44px;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border-radius: 8px;
      background:
        linear-gradient(
          135deg,
          #a855f7,
          #7c3aed
        );
      color: #ffffff;
      font-size: 13.5px;
      font-weight: 700;
      text-decoration: none;
      box-shadow: 0 6px 17px rgba(126, 34, 206, 0.25);
    }

    .goal-content > a svg {
      width: 18px;
      height: 18px;
    }

    .library-sidebar svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    @media (max-width: 900px) {
      .library-sidebar {
        grid-template-columns:
          repeat(2, 1fr);
      }

      .goal-card {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 590px) {
      .library-sidebar {
        grid-template-columns: 1fr;
      }

      .goal-card {
        grid-column: auto;
      }
    }
  `],
})
export class LibrarySidebarComponent {
    @Input({ required: true })
    statistics!: LibraryStatistics;

    @Input({ required: true })
    quickItems: readonly LibraryQuickItem[] =
        [];

    @Input({ required: true })
    goal!: LibraryReadingGoal;

    getGoalProgress(): number {
        if (!this.goal?.targetChapters) {
            return 0;
        }

        return Math.min(
            100,
            Math.round(
                (
                    this.goal.completedChapters /
                    this.goal.targetChapters
                ) * 100,
            ),
        );
    }
}