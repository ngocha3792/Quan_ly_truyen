
import {
    ChangeDetectionStrategy,
    Component,
    Input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
    AuthorWork,
} from '../../domain/author-detail.models';

@Component({
    selector: 'app-author-works',
    standalone: true,
    imports: [RouterLink],
    changeDetection: ChangeDetectionStrategy.OnPush,

    template: `
    <section class="works-panel">
      <header class="section-heading">
        <div>
          <svg viewBox="0 0 24 24">
            <path d="M12 3c-4 2-6 5-6 8.5A6 6 0 0 0 12 18c3.3 0 6-2.5 6-6 0-2.5-1.5-5-4-7 .4 2.2-.3 3.7-2 5-1.2-1.8-1.2-4 0-7Z"></path>
          </svg>

          <h2>Tác phẩm nổi bật</h2>
        </div>

        <a routerLink="/danh-sach">
          Xem tất cả

          <svg viewBox="0 0 24 24">
            <path d="M5 12h14"></path>
            <path d="m13 6 6 6-6 6"></path>
          </svg>
        </a>
      </header>

      <div class="works-grid">
        @for (work of works; track work.id) {
          <a
            class="work-card"
            [routerLink]="[
              '/truyen',
              work.slug
            ]"
          >
            <div
              class="work-cover"
              [class]="'work-cover work-cover--' + work.tone"
            >
              <span>{{ work.title.slice(0, 1) }}</span>

              <span class="cover-glow"></span>
            </div>

            <div class="work-content">
              <h3>{{ work.title }}</h3>

              <div class="genre-list">
                @for (genre of work.genres; track genre) {
                  <span>{{ genre }}</span>
                }
              </div>

              <p>{{ work.description }}</p>

              <footer>
                <span>
                  <svg viewBox="0 0 24 24">
                    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"></path>
                    <path d="M8 8h8"></path>
                  </svg>

                  Ch. {{ work.chapters }}
                </span>

                <strong>
                  <svg viewBox="0 0 24 24">
                    <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6-4.4-4.3 6.1-.9L12 3Z"></path>
                  </svg>

                  {{ work.rating }}
                </strong>
              </footer>
            </div>
          </a>
        }
      </div>
    </section>
  `,

    styles: [`
    :host {
      display: block;
    }

    .works-panel {
      margin-top: 0;
      padding: 1.25rem;
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

    .section-heading,
    .section-heading > div,
    .section-heading a {
      display: flex;
      align-items: center;
    }

    .section-heading {
      justify-content: space-between;
      gap: 15px;
      margin-bottom: 1rem;
    }

    .section-heading > div,
    .section-heading a {
      gap: 10px;
    }

    .section-heading h2 {
      margin: 0;
      color: var(--text-strong);
      font-size: 1.05rem;
      font-weight: 700;
    }

    .section-heading svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .section-heading > div svg,
    .section-heading a {
      color: #a773ef;
    }

    .section-heading a {
      font-size: .85rem;
      font-weight: 600;
      text-decoration: none;

      &:hover {
        color: var(--primary-soft);
      }
    }

    .section-heading a svg {
      width: 15px;
      height: 15px;
    }

    .works-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .work-card {
      display: grid;
      min-width: 0;
      grid-template-columns: 100px minmax(0, 1fr);
      gap: 14px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: rgba(11, 17, 32, 0.7);
      color: inherit;
      text-decoration: none;
      transition: border-color 0.2s ease, background-color 0.2s ease;
    }

    .work-card:hover {
      border-color: rgba(197, 143, 255, 0.35);
      background: rgba(19, 24, 45, 0.9);
    }

    .work-cover {
      position: relative;
      display: grid;
      min-height: 138px;
      place-items: center;
      overflow: hidden;
      border-radius: 8px;
      background: linear-gradient(145deg, #1e3a8a, #111827);
      color: rgba(255, 255, 255, 0.9);
      font-size: 40px;
      font-weight: 900;
      isolation: isolate;
    }

    .work-cover::before,
    .work-cover::after {
      position: absolute;
      content: "";
      z-index: -1;
    }

    .work-cover::before {
      right: -24px;
      bottom: -20px;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.14);
      filter: blur(4px);
    }

    .work-cover::after {
      bottom: -16px;
      width: 120%;
      height: 70px;
      background: rgba(4, 8, 18, 0.55);
      clip-path: polygon(
        0 100%,
        18% 45%,
        35% 76%,
        53% 30%,
        72% 68%,
        100% 25%,
        100% 100%
      );
    }

    .work-cover--gold {
      background: linear-gradient(145deg, #d9b66c, #3d2b1d);
    }

    .work-cover--violet {
      background: linear-gradient(145deg, #8b5cf6, #241240);
    }

    .work-cover--crimson {
      background: linear-gradient(145deg, #ef4444, #2c1017);
    }

    .work-cover--cyan {
      background: linear-gradient(145deg, #38bdf8, #122e4a);
    }

    .work-content {
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .work-content h3 {
      overflow: hidden;
      margin: 0 0 6px;
      color: var(--text-strong);
      font-size: 1rem;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .genre-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .genre-list span {
      padding: 3px 8px;
      border-radius: 4px;
      background: rgba(140, 77, 232, 0.15);
      color: var(--text-secondary);
      font-size: .78rem;
    }

    .work-content p {
      display: -webkit-box;
      overflow: hidden;
      margin: 8px 0 auto;
      color: var(--text-secondary);
      font-size: .85rem;
      line-height: 1.5;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .work-content footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 7px;
      margin-top: 10px;
      color: var(--text-muted);
      font-size: .8rem;
    }

    .work-content footer span,
    .work-content footer strong {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .work-content footer strong {
      color: #facc15;
    }

    .work-content footer svg {
      width: 12px;
      height: 12px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    @media (max-width: 1100px) {
      .works-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 560px) {
      .works-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class AuthorWorksComponent {
    @Input({ required: true })
    works: readonly AuthorWork[] = [];
}