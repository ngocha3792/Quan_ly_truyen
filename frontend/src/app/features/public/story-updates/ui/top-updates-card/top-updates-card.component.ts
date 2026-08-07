import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { RelativeTimePipe } from '../../../../../shared/pipes/relative-time.pipe';

import { StoryUpdateItem } from '../../domain/story-updates.models';

@Component({
  selector: 'app-top-updates-card',
  standalone: true,
  imports: [RouterLink, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="side-card">
      <header>
        <h2>Top cập nhật hôm nay</h2>

        <a routerLink="/xep-hang" [queryParams]="{ metric: 'trending' }"> Xem tất cả </a>
      </header>

      <div class="ranking-list">
        @for (story of stories(); track story.id; let rank = $index) {
          <a class="ranking-item" [routerLink]="['/truyen', story.slug]">
            <span class="rank" [class.top]="rank < 3">
              {{ rank + 1 }}
            </span>

            <div class="img-box">
              <img [src]="story.coverUrl" [alt]="story.title" loading="lazy" />
            </div>

            <div class="ranking-info">
              <strong>{{ story.title }}</strong>
              <span>Ch. {{ story.latestChapter }}</span>
            </div>

            <time>
              {{ story.updatedAt | relativeTime }}
            </time>
          </a>
        }
      </div>
    </section>
  `,
  styles: `
    .side-card {
      padding: 1.25rem;
      border: 1px solid var(--border, rgba(132, 145, 177, 0.16));
      border-radius: 12px;
      background: linear-gradient(145deg, rgba(17, 25, 44, 0.98), rgba(10, 16, 31, 0.98));
      box-shadow: 0 14px 35px rgba(0, 0, 0, 0.11);
    }

    header {
      margin-bottom: 14px;
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
      font-size: 0.85rem;
      text-decoration: none;
    }

    .ranking-list {
      display: grid;
    }

    .ranking-item {
      min-height: 60px;
      display: grid;
      grid-template-columns: 24px 44px minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border, rgba(132, 145, 177, 0.12));
      color: inherit;
      text-decoration: none;
    }

    .ranking-item:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }

    .rank {
      color: #7f899d;
      font-size: 1.1rem;
      font-weight: 850;
      text-align: center;
    }

    .rank.top {
      color: #efbd42;
    }

    .img-box {
      width: 44px;
      height: 56px;
      flex-shrink: 0;
      overflow: hidden;
      border-radius: 6px;
      background: #111827;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .ranking-info {
      min-width: 0;
      display: grid;
      gap: 4px;
    }

    strong {
      overflow: hidden;
      color: #dad7e0;
      font-size: 0.9rem;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ranking-info span {
      width: max-content;
      padding: 2px 6px;
      border-radius: 4px;
      color: #c180fb;
      font-size: 0.75rem;
      background: rgba(111, 54, 187, 0.2);
    }

    time {
      color: #788297;
      font-size: 0.8rem;
      white-space: nowrap;
    }
  `,
})
export class TopUpdatesCardComponent {
  readonly stories = input.required<readonly StoryUpdateItem[]>();
}
