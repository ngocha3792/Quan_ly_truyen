import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';

import { StoryRankingItem } from '../../domain/story-catalog.models';

@Component({
    selector: 'app-catalog-ranking',

    standalone: true,

    imports: [
        RouterLink,
        IconComponent,
        CompactNumberPipe,
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <section class="ranking-card">
      <header>
        <div>
          <app-icon
            name="trophy"
            [size]="18"
          />

          <h2>Top truyện nổi bật</h2>
        </div>

        <a routerLink="/xep-hang">
          Xem tất cả

          <app-icon
            name="chevron-right"
            [size]="13"
          />
        </a>
      </header>

      <div class="ranking-list">
        @for (
          story of stories();
          track story.id;
          let rank = $index
        ) {
          <a
            class="ranking-item"
            [routerLink]="[
              '/truyen',
              story.slug
            ]"
          >
            <span
              class="rank"
              [class.top]="rank < 3"
            >
              {{ rank + 1 }}
            </span>

            <img
              [src]="story.coverUrl"
              [alt]="story.title"
              loading="lazy"
            />

            <div class="ranking-copy">
              <strong>
                {{ story.title }}
              </strong>

              <small>
                {{
                  story.genres[0]?.name
                }}
              </small>

              <div>
                <span>
                  <app-icon
                    name="star"
                    [size]="12"
                  />

                  {{ story.rating }}
                </span>

                <span>
                  <app-icon
                    name="eye"
                    [size]="12"
                  />

                  {{
                    story.views
                      | compactNumber
                  }}
                </span>
              </div>
            </div>
          </a>
        }
      </div>
    </section>
  `,

    styles: `
    .ranking-card {
      padding: 18px;
      border: 1px solid var(--border);
      border-radius: 13px;
      background:
        linear-gradient(
          145deg,
          rgba(17, 25, 44, .98),
          rgba(10, 16, 31, .98)
        );
      box-shadow:
        0 18px 44px
        rgba(0, 0, 0, .11);
    }

    header {
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    header > div {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #bd7ef9;
    }

    h2 {
      margin: 0;
      color: #e9e7ee;
      font-size: 1.25rem;
    }

    header a {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #778196;
      font-size: .9rem;
      text-decoration: none;
    }

    .ranking-list {
      display: grid;
    }

    .ranking-item {
      min-height: 72px;
      display: grid;
      grid-template-columns:
        28px 48px minmax(0, 1fr);
      align-items: center;
      gap: 12px;
      color: inherit;
      text-decoration: none;
      border-bottom:
        1px solid var(--border);
    }

    .ranking-item:last-child {
      border-bottom: 0;
    }

    .rank {
      color: #7f899d;
      font-size: 1.35rem;
      font-weight: 850;
      text-align: center;
    }

    .rank.top {
      color: #f3b83f;
    }

    img {
      width: 48px;
      height: 60px;
      object-fit: cover;
      border-radius: 6px;
    }

    .ranking-copy {
      min-width: 0;
      display: grid;
      gap: 4px;
    }

    strong,
    small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      color: #e0dde6;
      font-size: 1.05rem;
    }

    small {
      color: #687287;
      font-size: .85rem;
    }

    .ranking-copy > div {
      display: flex;
      gap: 10px;
    }

    .ranking-copy > div span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #7e879a;
      font-size: .85rem;
    }

    .ranking-copy
    > div span:first-child {
      color: #f1b93f;
    }
  `,
})
export class CatalogRankingComponent {
    readonly stories =
        input.required<
            readonly StoryRankingItem[]
        >();
}