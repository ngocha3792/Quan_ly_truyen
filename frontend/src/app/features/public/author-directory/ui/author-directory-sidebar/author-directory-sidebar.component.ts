
import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  AuthorDirectoryStatistics,
  NewAuthorItem,
} from '../../domain/author-directory.models';

@Component({
  selector: 'app-author-directory-sidebar',
  standalone: true,
  imports: [
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <aside class="sidebar">
      <section class="sidebar-card statistics-card">
        <header class="card-header">
          <div>
            <svg viewBox="0 0 24 24">
              <path d="M4 20V10"></path>
              <path d="M10 20V4"></path>
              <path d="M16 20v-7"></path>
              <path d="M22 20V7"></path>
            </svg>

            <h2>Thống kê tác giả</h2>
          </div>
        </header>

        <div class="statistics-grid">
          <article>
            <span class="stat-icon">
              <svg viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="8"
                  r="3"
                ></circle>

                <path
                  d="M5 20c.5-4 2.8-6 7-6s6.5 2 7 6"
                ></path>
              </svg>
            </span>

            <div>
              <strong>
                {{ statistics.authors }}
              </strong>

              <small>Tác giả</small>
            </div>
          </article>

          <article>
            <span class="stat-icon">
              <svg viewBox="0 0 24 24">
                <path
                  d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"
                ></path>

                <path d="M8 8h8"></path>
              </svg>
            </span>

            <div>
              <strong>
                {{ statistics.works }}
              </strong>

              <small>Tác phẩm</small>
            </div>
          </article>

          <article>
            <span class="stat-icon">
              <svg viewBox="0 0 24 24">
                <path
                  d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                ></path>

                <circle
                  cx="12"
                  cy="12"
                  r="2.5"
                ></circle>
              </svg>
            </span>

            <div>
              <strong>
                {{ statistics.reads }}
              </strong>

              <small>Lượt đọc</small>
            </div>
          </article>

          <article>
            <span class="stat-icon">
              <svg viewBox="0 0 24 24">
                <circle
                  cx="9"
                  cy="8"
                  r="3"
                ></circle>

                <path
                  d="M3.5 19c.5-3.4 2.3-5 5.5-5s5 1.6 5.5 5"
                ></path>

                <path
                  d="M16 6a3 3 0 0 1 0 5"
                ></path>
              </svg>
            </span>

            <div>
              <strong>
                {{ statistics.followers }}
              </strong>

              <small>Người theo dõi</small>
            </div>
          </article>
        </div>
      </section>

      <section class="sidebar-card new-authors-card">
        <header class="card-header">
          <div>
            <svg viewBox="0 0 24 24">
              <circle
                cx="8"
                cy="8"
                r="3"
              ></circle>

              <path
                d="M2.5 19c.5-3.4 2.3-5 5.5-5s5 1.6 5.5 5"
              ></path>

              <path d="M17 8v6"></path>
              <path d="M14 11h6"></path>
            </svg>

            <h2>Tác giả mới</h2>
          </div>

          <a routerLink="/tac-gia">
            Xem tất cả

            <svg viewBox="0 0 24 24">
              <path d="m9 18 6-6-6-6"></path>
            </svg>
          </a>
        </header>

        <div class="new-author-list">
          @for (
            author of newAuthors;
            track author.id
          ) {
            <a
              class="new-author"
              [routerLink]="[
                '/tac-gia',
                author.slug
              ]"
            >
              <div class="mini-avatar">
                {{ author.initials }}

                @if (author.verified) {
                  <span>
                    <svg viewBox="0 0 24 24">
                      <path
                        d="m12 2 2.1 2.2 3-.3.9 2.9 2.7 1.5-1.2 2.8 1.2 2.8-2.7 1.5-.9 2.9-3-.3L12 22l-2.1-2.2-3 .3-.9-2.9-2.7-1.5 1.2-2.8-1.2-2.8L6 8.6l.9-2.9 3 .3L12 2Z"
                      ></path>

                      <path
                        d="m8.5 12 2.2 2.2 4.8-4.8"
                      ></path>
                    </svg>
                  </span>
                }
              </div>

              <div class="new-author-info">
                <strong>
                  {{ author.name }}
                </strong>

                <p>
                  <span>
                    {{ author.worksLabel }}
                  </span>

                  <span>
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                      ></path>

                      <circle
                        cx="12"
                        cy="12"
                        r="2.5"
                      ></circle>
                    </svg>

                    {{ author.readsLabel }}
                  </span>
                </p>
              </div>

              <svg
                class="author-chevron"
                viewBox="0 0 24 24"
              >
                <path d="m9 18 6-6-6-6"></path>
              </svg>
            </a>
          }
        </div>
      </section>

      <section class="author-cta">
        <div class="cta-content">
          <h2>Trở thành tác giả</h2>

          <p>
            Chia sẻ câu chuyện của bạn với hàng triệu độc giả.
          </p>

          <a routerLink="/dang-ky-tac-gia">
            Bắt đầu ngay

            <svg viewBox="0 0 24 24">
              <path d="M5 12h14"></path>
              <path d="m13 6 6 6-6 6"></path>
            </svg>
          </a>
        </div>

        <div class="quill" aria-hidden="true">
          <span class="quill-feather"></span>
          <span class="quill-base"></span>
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

    .sidebar-card,
    .author-cta {
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 13px;
      background:
        linear-gradient(
          145deg,
          rgba(17, 25, 44, 0.98),
          rgba(10, 16, 31, 0.98)
        );
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.11);
    }

    .card-header,
    .card-header > div,
    .card-header a {
      display: flex;
      align-items: center;
    }

    .card-header {
      justify-content: space-between;
      gap: 12px;
      padding: 1.1rem 1.25rem .75rem;
    }

    .card-header > div,
    .card-header a {
      gap: 10px;
    }

    .card-header h2 {
      margin: 0;
      color: #e9e7ee;
      font-size: 1.05rem;
      font-weight: 700;
    }

    .card-header svg {
      width: 19px;
      height: 19px;
      color: #b779f6;
    }

    .card-header a {
      color: #a773ef;
      font-size: .85rem;
      font-weight: 600;
      text-decoration: none;

      &:hover {
        color: var(--primary-soft);
      }
    }

    .card-header a svg {
      width: 13px;
      height: 13px;
    }

    .statistics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      padding: 2px 1.25rem 1rem;
    }

    .statistics-grid article {
      display: grid;
      min-height: 72px;
      grid-template-columns: 42px minmax(0, 1fr);
      align-items: center;
      gap: 10px;
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: rgba(5, 10, 21, 0.46);
    }

    .stat-icon {
      display: grid;
      width: 40px;
      height: 40px;
      place-items: center;
      border-radius: 8px;
      background: rgba(125, 61, 204, 0.15);
      color: var(--primary-soft);
    }

    .stat-icon svg {
      width: 22px;
      height: 22px;
    }

    .statistics-grid strong {
      display: block;
      color: var(--text-strong);
      font-size: 15px;
      font-weight: 700;
    }

    .statistics-grid small {
      color: var(--text-muted);
      font-size: 11.5px;
    }

    .new-author-list {
      padding: 0 1.25rem 1rem;
    }

    .new-author {
      display: grid;
      min-height: 60px;
      grid-template-columns: 42px minmax(0, 1fr) 16px;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid var(--border);
      color: inherit;
      text-decoration: none;
    }

    .new-author:last-child {
      border-bottom: 0;
    }

    .new-author:hover {
      background: rgba(140, 77, 232, 0.06);
    }

    .mini-avatar {
      position: relative;
      display: grid;
      width: 38px;
      height: 38px;
      place-items: center;
      border: 1px solid rgba(168, 85, 247, 0.45);
      border-radius: 50%;
      background:
        linear-gradient(
          145deg,
          rgba(30, 27, 75, 0.85),
          rgba(15, 23, 42, 0.95)
        );
      color: #f8f6fb;
      font-size: 13px;
      font-weight: 800;
    }

    .mini-avatar > span {
      position: absolute;
      right: -2px;
      bottom: -2px;
      display: grid;
      width: 14px;
      height: 14px;
      place-items: center;
      border: 2px solid #0c1325;
      border-radius: 50%;
      background: var(--primary);
      color: #ffffff;
    }

    .mini-avatar > span svg {
      width: 10px;
      height: 10px;
    }

    .new-author-info {
      min-width: 0;
    }

    .new-author-info strong {
      display: block;
      overflow: hidden;
      margin-bottom: 3px;
      color: var(--text-strong);
      font-size: 13.5px;
      font-weight: 650;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .new-author-info p {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      color: var(--text-muted);
      font-size: 11.5px;
    }

    .new-author-info p span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .new-author-info p svg {
      width: 12px;
      height: 12px;
    }

    .author-chevron {
      width: 14px;
      height: 14px;
      color: var(--text-muted);
    }

    .author-cta {
      position: relative;
      display: grid;
      min-height: 180px;
      grid-template-columns: minmax(0, 1fr) 130px;
      align-items: center;
      padding: 1.25rem;
      background:
        radial-gradient(
          circle at 78% 48%,
          rgba(126, 34, 206, 0.27),
          transparent 38%
        ),
        linear-gradient(
          145deg,
          rgba(25, 17, 50, 0.98),
          rgba(11, 16, 31, 0.98)
        );
    }

    .cta-content {
      position: relative;
      z-index: 2;
    }

    .cta-content h2 {
      margin: 0;
      color: var(--primary-soft);
      font-size: 1.15rem;
      font-weight: 700;
    }

    .cta-content p {
      max-width: 170px;
      margin: 8px 0 16px;
      color: var(--text-secondary);
      font-size: .85rem;
      line-height: 1.5;
    }

    .cta-content a {
      display: inline-flex;
      min-height: 38px;
      align-items: center;
      gap: 10px;
      padding: 0 16px;
      border: 1px solid rgba(216, 180, 254, 0.24);
      border-radius: 8px;
      background:
        linear-gradient(
          135deg,
          var(--primary),
          #7c3aed
        );
      color: #ffffff;
      font-size: .85rem;
      font-weight: 650;
      text-decoration: none;
      box-shadow: 0 7px 22px rgba(126, 34, 206, 0.23);
    }

    .cta-content a svg {
      width: 15px;
      height: 15px;
    }

    .quill {
      position: relative;
      width: 120px;
      height: 130px;
    }

    .quill-feather {
      position: absolute;
      top: 2px;
      left: 49px;
      width: 31px;
      height: 100px;
      border-radius: 80% 10% 80% 10%;
      background:
        linear-gradient(
          135deg,
          #d8b4fe,
          #9333ea 50%,
          #6d28d9
        );
      box-shadow: 0 0 25px rgba(168, 85, 247, 0.35);
      transform: rotate(24deg);
    }

    .quill-feather::before {
      position: absolute;
      top: 11px;
      left: 14px;
      width: 2px;
      height: 85px;
      content: "";
      background: rgba(255, 255, 255, 0.48);
    }

    .quill-base {
      position: absolute;
      right: 15px;
      bottom: 11px;
      width: 84px;
      height: 27px;
      border-radius: 50%;
      background:
        radial-gradient(
          ellipse,
          rgba(168, 85, 247, 0.45),
          rgba(76, 29, 149, 0.08) 68%,
          transparent 70%
        );
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

      .author-cta {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 620px) {
      .sidebar {
        grid-template-columns: 1fr;
      }

      .author-cta {
        grid-column: auto;
      }
    }
  `],
})
export class AuthorDirectorySidebarComponent {
  @Input({ required: true })
  statistics!: AuthorDirectoryStatistics;

  @Input({ required: true })
  newAuthors: readonly NewAuthorItem[] = [];
}