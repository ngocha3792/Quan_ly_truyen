import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { GenreTrendingItem } from '../../domain/genre-discovery.models';

@Component({
  selector:
    'app-genre-trending-card',

  standalone: true,

  imports: [RouterLink, DecimalPipe],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <section class="trending-card">
      <h2>
        Thể loại được đọc nhiều tuần này
      </h2>

      <div class="trending-list">
        @for (
          item of items();
          track item.id
        ) {
          <a
            class="trending-item"
            [routerLink]="['/danh-sach']"
            [queryParams]="{
              genre: item.slug,
              sort: 'popular'
            }"
          >
            <img
              [src]="
                item.coverUrl ||
                '/assets/mock/genres/default.webp'
              "
              [alt]="item.name"
              loading="lazy"
            />

            <div>
              <strong>{{ item.name }}</strong>

              <span class="progress">
                <span
                  [attr.data-tone]="
                    item.tone
                  "
                  [style.width.%]="
                    item.percent
                  "
                ></span>
              </span>
            </div>

            <small>
              {{
                item.percent
                  | number: '1.1-1'
              }}%
            </small>
          </a>
        }
      </div>

      <a
        class="statistics-link"
        routerLink="/xep-hang"
      >
        Xem chi tiết thống kê
      </a>
    </section>
  `,

    styles: `
    .trending-card {
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background:
        linear-gradient(
          145deg,
          rgba(17, 25, 44, .95),
          rgba(9, 15, 29, .95)
        );
    }

    h2 {
      margin: 0 0 12px;
      color: #f0edf4;
      font-size: .875rem;
      line-height: 1.4;
    }

    .trending-list {
      display: grid;
      gap: 9px;
    }

    .trending-item {
      display: grid;
      grid-template-columns:
        34px minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      color: inherit;
      text-decoration: none;
    }

    img {
      width: 34px;
      height: 34px;
      object-fit: cover;
      border-radius: 5px;
    }

    .trending-item > div {
      min-width: 0;
      display: grid;
      gap: 5px;
    }

    strong {
      color: #dcd9e1;
      font-size: .75rem;
    }

    small {
      color: #a9b0be;
      font-size: .6875rem;
    }

    .progress {
      height: 3px;
      overflow: hidden;
      border-radius: 10px;
      background: #263045;
    }

    .progress > span {
      height: 100%;
      min-width: 3px;
      display: block;
      border-radius: inherit;
      background:
        linear-gradient(
          90deg,
          #743bde,
          #a153eb
        );
    }

    .progress
    > span[data-tone='red'] {
      background:
        linear-gradient(
          90deg,
          #ef4444,
          #fb7185
        );
    }

    .progress
    > span[data-tone='pink'] {
      background:
        linear-gradient(
          90deg,
          #db2777,
          #f472b6
        );
    }

    .progress
    > span[data-tone='yellow'] {
      background:
        linear-gradient(
          90deg,
          #d97706,
          #facc15
        );
    }

    .statistics-link {
      min-height: 34px;
      margin-top: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid
        rgba(127, 68, 205, .37);
      border-radius: 6px;
      color: #ba7af5;
      font-size: .75rem;
      font-weight: 700;
      text-decoration: none;
      background:
        rgba(95, 42, 151, .1);
    }
  `,
})
export class GenreTrendingCardComponent {
    readonly items =
        input.required<
            readonly GenreTrendingItem[]
        >();
}