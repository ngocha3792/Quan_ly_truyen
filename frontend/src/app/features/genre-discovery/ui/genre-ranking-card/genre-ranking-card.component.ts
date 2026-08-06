import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../shared/pipes/compact-number.pipe';

import { GenreRankingItem } from '../../domain/genre-discovery.models';

@Component({
    selector:
        'app-genre-ranking-card',

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
            name="fire"
            [size]="16"
          />

          <h2>Top thể loại</h2>
        </div>
      </header>

      <div class="ranking-list">
        @for (
          item of items();
          track item.id
        ) {
          <a
            class="ranking-item"
            [routerLink]="['/danh-sach']"
            [queryParams]="{
              genre: item.slug,
              sort: 'popular'
            }"
          >
            <span
              class="rank"
              [attr.data-rank]="item.rank"
            >
              {{ item.rank }}
            </span>

            <strong>{{ item.name }}</strong>

            <small>
              {{
                item.storyCount
                  | compactNumber
              }}
              truyện
            </small>
          </a>
        }
      </div>

      <a
        class="ranking-link"
        routerLink="/xep-hang"
      >
        Xem tất cả bảng xếp hạng
      </a>
    </section>
  `,

    styles: `
    .ranking-card {
      padding: 1.25rem;
      border: 1px solid var(--border);
      border-radius: 12px;
      background:
        linear-gradient(
          145deg,
          rgba(17, 25, 44, .95),
          rgba(9, 15, 29, .95)
        );
    }

    header {
      margin-bottom: 1rem;
    }

    header > div {
      display: flex;
      align-items: center;
      gap: 7px;
      color: #fb7185;
    }

    h2 {
      margin: 0;
      color: #f0edf4;
      font-size: 1.15rem;
    }

    .ranking-list {
      display: grid;
    }

    .ranking-item {
      min-height: 44px;
      display: grid;
      grid-template-columns:
        28px minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      color: inherit;
      text-decoration: none;
    }

    .rank {
      width: 26px;
      height: 26px;
      display: grid;
      place-items: center;
      border: 1px solid
        rgba(122, 135, 165, .34);
      border-radius: 50%;
      color: #99a2b4;
      font-size: .85rem;
      font-weight: 800;
    }

    .rank[data-rank='1'] {
      border-color: #b866f4;
      color: #c77cf9;
    }

    .rank[data-rank='2'] {
      border-color: #6390df;
      color: #78a3ee;
    }

    .rank[data-rank='3'] {
      border-color: #dd6c48;
      color: #ef835e;
    }

    strong {
      color: #dfdce4;
      font-size: 1rem;
    }

    small {
      color: #778195;
      font-size: .85rem;
    }

    .ranking-link {
      min-height: 40px;
      margin-top: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid
        rgba(127, 68, 205, .37);
      border-radius: 8px;
      color: #ba7af5;
      font-size: .9rem;
      font-weight: 700;
      text-decoration: none;
      background:
        rgba(95, 42, 151, .1);
    }
  `,
})
export class GenreRankingCardComponent {
    readonly items =
        input.required<
            readonly GenreRankingItem[]
        >();
}