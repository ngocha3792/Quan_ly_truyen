
import {
    ChangeDetectionStrategy,
    Component,
    Input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
    AuthorHotWork,
    AuthorRecentUpdate,
    AuthorStatistics,
} from '../../domain/author-detail.models';

@Component({
    selector: 'app-author-sidebar',
    standalone: true,
    imports: [RouterLink],
    changeDetection: ChangeDetectionStrategy.OnPush,

    template: `
    <aside class="sidebar">
      <section class="sidebar-card quick-info">
        <header>
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 11v5"></path>
            <path d="M12 8h.01"></path>
          </svg>

          <h2>Thông tin nhanh</h2>
        </header>

        <div class="quick-row">
          <span>Gia nhập</span>
          <strong>{{ joinedAt }}</strong>
        </div>

        <div class="quick-row">
          <span>Tổng lượt đọc</span>
          <strong>{{ statistics.totalReads }}</strong>
        </div>

        <div class="quick-row">
          <span>Người theo dõi</span>
          <strong>{{ statistics.followers }}</strong>
        </div>

        <div class="quick-row">
          <span>Tác phẩm</span>
          <strong>{{ statistics.totalWorks }} truyện</strong>
        </div>

        <div class="quick-row">
          <span>Đánh giá trung bình</span>

          <strong class="rating">
            ★ {{ statistics.averageRating }}
          </strong>
        </div>
      </section>

      <section class="sidebar-card updates-card">
        <header>
          <div>
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 7v5l3 2"></path>
            </svg>

            <h2>Lịch cập nhật gần đây</h2>
          </div>

          <a routerLink="/cap-nhat">
            Xem tất cả
          </a>
        </header>

        <div class="update-list">
          @for (update of recentUpdates; track update.id) {
            <article>
              <span class="update-dot"></span>

              <p>
                {{ update.workTitle }} -
                {{ update.chapterTitle }}
              </p>

              <time>{{ update.updatedAt }}</time>
            </article>
          }
        </div>
      </section>

      <section class="sidebar-card hot-card">
        <header>
          <div>
            <svg viewBox="0 0 24 24">
              <path d="M12 3c-4 2-6 5-6 8.5A6 6 0 0 0 12 18c3.3 0 6-2.5 6-6 0-2.5-1.5-5-4-7 .4 2.2-.3 3.7-2 5-1.2-1.8-1.2-4 0-7Z"></path>
            </svg>

            <h2>Tác phẩm đang hot</h2>
          </div>

          <a routerLink="/xep-hang">
            Xem tất cả
          </a>
        </header>

        <div class="hot-list">
          @for (work of hotWorks; track work.rank) {
            <article>
              <strong class="rank">
                {{ work.rank }}
              </strong>

              <span
                class="mini-cover"
                [class]="'mini-cover mini-cover--' + work.tone"
              >
                {{ work.title.slice(0, 1) }}
              </span>

              <div>
                <h3>{{ work.title }}</h3>
                <small>{{ work.genre }}</small>
              </div>

              <span class="hot-reads">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3c-4 2-6 5-6 8.5A6 6 0 0 0 12 18c3.3 0 6-2.5 6-6 0-2.5-1.5-5-4-7 .4 2.2-.3 3.7-2 5-1.2-1.8-1.2-4 0-7Z"></path>
                </svg>

                {{ work.reads }}
              </span>
            </article>
          }
        </div>
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
          rgba(16, 22, 39, 0.9),
          rgba(10, 15, 28, 0.92)
        );
      box-shadow: 0 14px 35px rgba(0, 0, 0, 0.15);
    }

    header,
    header > div {
      display: flex;
      align-items: center;
    }

    header {
      justify-content: space-between;
      gap: 12px;
      padding: 1.1rem 1.25rem .75rem;
    }

    header > div {
      gap: 10px;
    }

    header svg {
      display: none;
    }

    header h2 {
      margin: 0;
      color: var(--text-strong);
      font-size: 1rem;
      font-weight: 700;
    }

    header a {
      color: #a773ef;
      font-size: .85rem;
      font-weight: 600;
      text-decoration: none;

      &:hover {
        color: var(--primary-soft);
      }
    }

    .quick-info > header {
      justify-content: flex-start;
    }

    .quick-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      min-height: 42px;
      margin: 0 1.25rem;
      border-bottom: 1px solid var(--border);
      color: var(--text-secondary);
      font-size: .85rem;
    }

    .quick-row:last-child {
      margin-bottom: 10px;
      border-bottom: 0;
    }

    .quick-row strong {
      color: var(--text-strong);
      font-weight: 600;
    }

    .quick-row .rating {
      color: #facc15;
    }

    .update-list {
      padding: 2px 1.25rem 1rem;
    }

    .update-list article {
      display: grid;
      grid-template-columns: 8px minmax(0, 1fr) auto;
      align-items: center;
      gap: 9px;
      min-height: 38px;
      border-bottom: 1px solid var(--border);
    }

    .update-list article:last-child {
      border-bottom: 0;
    }

    .update-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--primary-soft);
      box-shadow: 0 0 8px rgba(140, 77, 232, 0.5);
    }

    .update-list p {
      overflow: hidden;
      margin: 0;
      color: var(--text-secondary);
      font-size: .85rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .update-list time {
      color: var(--text-muted);
      font-size: .78rem;
    }

    .hot-list {
      padding: 0 1.25rem 1rem;
    }

    .hot-list article {
      display: grid;
      grid-template-columns: 20px 42px minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      min-height: 64px;
      border-bottom: 1px solid var(--border);
    }

    .hot-list article:last-child {
      border-bottom: 0;
    }

    .rank {
      color: #facc15;
      font-size: .95rem;
      font-weight: 700;
      text-align: center;
    }

    .mini-cover {
      display: grid;
      width: 40px;
      height: 48px;
      place-items: center;
      border-radius: 5px;
      background: linear-gradient(145deg, #1e3a8a, #111827);
      color: rgba(255, 255, 255, 0.9);
      font-size: 18px;
      font-weight: 800;
    }

    .mini-cover--gold {
      background: linear-gradient(145deg, #d9b66c, #3d2b1d);
    }

    .mini-cover--violet {
      background: linear-gradient(145deg, #8b5cf6, #241240);
    }

    .mini-cover--crimson {
      background: linear-gradient(145deg, #ef4444, #2c1017);
    }

    .mini-cover--cyan {
      background: linear-gradient(145deg, #38bdf8, #122e4a);
    }

    .hot-list h3 {
      overflow: hidden;
      margin: 0 0 3px;
      color: var(--text-strong);
      font-size: .9rem;
      font-weight: 650;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .hot-list small {
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(140, 77, 232, 0.15);
      color: var(--text-muted);
      font-size: .78rem;
    }

    .hot-reads {
      display: flex;
      align-items: center;
      gap: 5px;
      color: var(--text-muted);
      font-size: .78rem;
    }

    .hot-reads svg {
      display: block;
      width: 13px;
      height: 13px;
      fill: none;
      stroke: var(--primary-soft);
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `],
})
export class AuthorSidebarComponent {
    @Input({ required: true })
    statistics!: AuthorStatistics;

    @Input()
    joinedAt = '';

    @Input({ required: true })
    recentUpdates: readonly AuthorRecentUpdate[] = [];

    @Input({ required: true })
    hotWorks: readonly AuthorHotWork[] = [];
}