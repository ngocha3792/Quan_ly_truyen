import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { GenreRankingDistribution } from '../../domain/story-ranking.models';

@Component({
    selector:
        'app-genre-distribution-card',

    standalone: true,

    imports: [RouterLink],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <section class="distribution-card">
      <header>
        <h2>Thể loại nổi bật</h2>

        <a routerLink="/the-loai">
          Xem tất cả
        </a>
      </header>

      <div class="genre-list">
        @for (
          genre of genres();
          track genre.slug
        ) {
          <a
            class="genre-row"
            routerLink="/danh-sach"
            [queryParams]="{
              genre: genre.slug,
              sort: 'popular'
            }"
          >
            <span
              class="genre-dot"
              [attr.data-tone]="
                genre.tone
              "
            ></span>

            <strong>
              {{ genre.name }}
            </strong>

            <span class="progress">
              <span
                [attr.data-tone]="
                  genre.tone
                "
                [style.width.%]="
                  genre.percentage
                "
              ></span>
            </span>

            <small>
              {{ genre.percentage }}%
            </small>
          </a>
        }
      </div>
    </section>
  `,

    styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .distribution-card {
      padding: 1.25rem;
      border: 1px solid var(--border);
      border-radius: 12px;
      background:
        linear-gradient(
          145deg,
          rgba(16, 24, 42, .96),
          rgba(9, 15, 29, .96)
        );
    }

    header {
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    h2 {
      margin: 0;
      color: #ece9f0;
      font-size: 1.15rem;
    }

    header a {
      color: #a86bea;
      font-size: .9rem;
      text-decoration: none;
    }

    .genre-list {
      display: grid;
      gap: .875rem;
    }

    .genre-row {
      display: grid;
      grid-template-columns:
        8px 80px minmax(0, 1fr) 40px;
      align-items: center;
      gap: .75rem;
      color: inherit;
      text-decoration: none;
    }

    .genre-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #9150e8;
    }

    .genre-dot[data-tone='blue'] {
      background: #608bf5;
    }

    .genre-dot[data-tone='pink'] {
      background: #eb5ba5;
    }

    .genre-dot[data-tone='orange'] {
      background: #f0843f;
    }

    .genre-dot[data-tone='green'] {
      background: #3aa4e9;
    }

    strong {
      color: #d8d5df;
      font-size: 1rem;
    }

    small {
      color: #929bad;
      font-size: .85rem;
      text-align: right;
    }

    .progress {
      height: 4px;
      overflow: hidden;
      border-radius: 20px;
      background: #242d42;
    }

    .progress > span {
      height: 100%;
      min-width: 3px;
      display: block;
      border-radius: inherit;
      background: #9654e8;
    }

    .progress
    > span[data-tone='blue'] {
      background: #608bf5;
    }

    .progress
    > span[data-tone='pink'] {
      background: #e65ba0;
    }

    .progress
    > span[data-tone='orange'] {
      background: #ef843d;
    }

    .progress
    > span[data-tone='green'] {
      background: #429de0;
    }
  `,
})
export class GenreDistributionCardComponent {
    readonly genres =
        input.required<
            readonly GenreRankingDistribution[]
        >();
}