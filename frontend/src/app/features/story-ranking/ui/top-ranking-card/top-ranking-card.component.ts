import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../shared/pipes/compact-number.pipe';

import { StoryRankingItem } from '../../domain/story-ranking.models';

import { RankMovementComponent } from '../rank-movement/rank-movement.component';

export type TopRankingVariant =
    | 'first'
    | 'second'
    | 'third';

@Component({
    selector:
        'app-top-ranking-card',

    standalone: true,

    imports: [
        RouterLink,
        IconComponent,
        CompactNumberPipe,
        RankMovementComponent,
    ],

    template: `
    <a
      class="top-card"
      [attr.data-variant]="
        variant()
      "
      [routerLink]="[
        '/truyen',
        story().slug
      ]"
    >
      <div class="rank-column">
        <strong>
          {{ story().rank }}
        </strong>

        @if (
          variant() === 'first'
        ) {
          <app-icon
            name="trophy"
            [size]="18"
          />
        }

        <app-rank-movement
          [delta]="
            story().rankChange
          "
        />
      </div>

      <img
        [src]="story().coverUrl"
        [alt]="story().title"
      />

      <div class="story-content">
        <h3>{{ story().title }}</h3>

        <div class="genre-list">
          @for (
            genre of
              story().genres.slice(
                0,
                2
              );
            track genre.slug
          ) {
            <span>
              {{ genre.name }}
            </span>
          }
        </div>

        <div class="rating">
          <app-icon
            name="star"
            [size]="14"
          />

          <strong>
            {{ story().rating }}
          </strong>

          <span>
            {{
              story().ratingCount
                | compactNumber
            }}
            đánh giá
          </span>
        </div>

        <div class="views">
          <app-icon
            name="eye"
            [size]="14"
          />

          {{
            story().viewCount
              | compactNumber
          }}
          lượt đọc
        </div>
      </div>
    </a>
  `,

    styleUrl:
        './top-ranking-card.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class TopRankingCardComponent {
    readonly story =
        input.required<StoryRankingItem>();

    readonly variant =
        input.required<TopRankingVariant>();
}