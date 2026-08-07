import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { AuthorStatistics } from '../../domain/author-detail.models';

@Component({
  selector: 'app-author-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="statistics">
      <article class="stat-card">
        <span class="stat-icon">
          <svg viewBox="0 0 24 24">
            <path
              d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"
            ></path>
            <path d="M8 8h8"></path>
            <path d="M8 12h8"></path>
            <path d="M8 16h5"></path>
          </svg>
        </span>

        <div>
          <small>Tác phẩm</small>
          <strong>{{ statistics.totalWorks }}</strong>
          <p>Truyện đã xuất bản</p>
        </div>
      </article>

      <article class="stat-card">
        <span class="stat-icon">
          <svg viewBox="0 0 24 24">
            <circle cx="9" cy="8" r="3"></circle>
            <path d="M3.5 19c.5-3.4 2.3-5 5.5-5s5 1.6 5.5 5"></path>
            <path d="M16 6a3 3 0 0 1 0 5"></path>
            <path d="M16.5 14c2.3.4 3.6 2 4 4.5"></path>
          </svg>
        </span>

        <div>
          <small>Người theo dõi</small>
          <strong>{{ statistics.followers }}</strong>
          <p>Đang theo dõi tác giả</p>
        </div>
      </article>

      <article class="stat-card">
        <span class="stat-icon">
          <svg viewBox="0 0 24 24">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path>
            <circle cx="12" cy="12" r="2.5"></circle>
          </svg>
        </span>

        <div>
          <small>Lượt đọc</small>
          <strong>{{ statistics.totalReads }}</strong>
          <p>Tổng lượt đọc truyện</p>
        </div>
      </article>

      <article class="stat-card">
        <span class="stat-icon">
          <svg viewBox="0 0 24 24">
            <path
              d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6-4.4-4.3 6.1-.9L12 3Z"
            ></path>
          </svg>
        </span>

        <div>
          <small>Đánh giá</small>
          <strong>{{ statistics.averageRating }}</strong>
          <p>Điểm đánh giá trung bình</p>
        </div>
      </article>
    </section>
  `,

  styles: [
    `
      :host {
        display: block;
      }

      .statistics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1rem;
        margin-top: 0;
      }

      .stat-card {
        display: grid;
        min-height: 88px;
        grid-template-columns: 48px minmax(0, 1fr);
        align-items: center;
        gap: 12px;
        padding: 1rem 1.15rem;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: linear-gradient(145deg, rgba(16, 22, 39, 0.9), rgba(10, 15, 28, 0.92));
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
      }

      .stat-icon {
        display: grid;
        width: 44px;
        height: 44px;
        place-items: center;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(140, 77, 232, 0.28), rgba(76, 29, 149, 0.08));
        color: var(--primary-soft);
        box-shadow: 0 0 16px rgba(140, 77, 232, 0.12);
      }

      .stat-icon svg {
        width: 22px;
        height: 22px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      small,
      strong,
      p {
        display: block;
      }

      small {
        color: var(--text-secondary);
        font-size: 0.82rem;
        font-weight: 600;
      }

      strong {
        margin-top: 2px;
        color: var(--text-strong);
        font-size: 1.35rem;
        font-weight: 700;
        line-height: 1.1;
      }

      p {
        margin: 3px 0 0;
        color: var(--text-muted);
        font-size: 0.75rem;
      }

      @media (max-width: 900px) {
        .statistics {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 520px) {
        .statistics {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AuthorStatsComponent {
  @Input({ required: true })
  statistics!: AuthorStatistics;
}
