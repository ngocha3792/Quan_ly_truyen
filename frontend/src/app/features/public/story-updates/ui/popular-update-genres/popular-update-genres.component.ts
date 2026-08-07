import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { StoryUpdateGenreSummary } from '../../domain/story-updates.models';

@Component({
    selector: 'app-popular-update-genres',
    standalone: true,
    imports: [RouterLink],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <section class="side-card">
      <header>
        <h2>Thể loại nổi bật</h2>
        <a routerLink="/the-loai">Xem tất cả</a>
      </header>

      <div class="genre-list">
        @for (genre of genres(); track genre.slug) {
          <a
            routerLink="/danh-sach"
            [queryParams]="{ genre: genre.slug, sort: 'latest' }"
          >
            {{ genre.name }}
          </a>
        }
      </div>
    </section>
  `,
    styles: `
    .side-card {
      padding: 1.25rem;
      border: 1px solid var(--border, rgba(132, 145, 177, .16));
      border-radius: 12px;
      background: linear-gradient(
        145deg,
        rgba(17, 25, 44, .98),
        rgba(10, 16, 31, .98)
      );
    }

    header {
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    h2 {
      margin: 0;
      color: #ece9f0;
      font-size: 1.1rem;
      font-weight: 700;
    }

    header a {
      color: #a76cea;
      font-size: .85rem;
      text-decoration: none;
    }

    .genre-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .genre-list a {
      min-height: 30px;
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      border: 1px solid rgba(132, 145, 177, .16);
      border-radius: 6px;
      color: #b7becb;
      font-size: .85rem;
      text-decoration: none;
      background: rgba(52, 63, 88, .28);
      transition: all 150ms ease;
    }

    .genre-list a:hover {
      color: #c789ff;
      border-color: rgba(155, 91, 236, .35);
      background: rgba(125, 61, 204, .15);
    }
  `,
})
export class PopularUpdateGenresComponent {
    readonly genres = input.required<readonly StoryUpdateGenreSummary[]>();
}