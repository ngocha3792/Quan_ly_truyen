import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';

import {
    StoryRankingMetric,
    StoryRankingPeriod,
} from '../../domain/story-ranking.models';

interface FilterOption<T> {
    readonly value: T;
    readonly label: string;
}

@Component({
    selector:
        'app-ranking-filter-bar',

    standalone: true,

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <section class="filter-bar">
      <div
        class="filter-group"
        role="tablist"
        aria-label="Khoảng thời gian"
      >
        @for (
          option of periods;
          track option.value
        ) {
          <button
            type="button"
            role="tab"
            [class.active]="
              period() ===
              option.value
            "
            [attr.aria-selected]="
              period() ===
              option.value
            "
            (click)="
              periodChange.emit(
                option.value
              )
            "
          >
            {{ option.label }}
          </button>
        }
      </div>

      <div
        class="filter-group metric-group"
        role="tablist"
        aria-label="Tiêu chí xếp hạng"
      >
        @for (
          option of metrics;
          track option.value
        ) {
          <button
            type="button"
            role="tab"
            [class.active]="
              metric() ===
              option.value
            "
            [attr.aria-selected]="
              metric() ===
              option.value
            "
            (click)="
              metricChange.emit(
                option.value
              )
            "
          >
            {{ option.label }}
          </button>
        }
      </div>
    </section>
  `,

    styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1.5rem;
    }

    .filter-group {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 7px;
    }

    button {
      min-height: 31px;
      padding: 0 13px;
      flex: 0 0 auto;
      border: 1px solid
        rgba(132, 145, 177, .15);
      border-radius: 7px;
      color: #969fb0;
      font-size: .85rem;
      font-weight: 620;
      cursor: pointer;
      background:
        rgba(12, 18, 33, .72);
      transition:
        color 160ms ease,
        border-color 160ms ease,
        background 160ms ease;
    }

    button:hover {
      color: #e8e5ed;
      border-color:
        rgba(155, 92, 238, .3);
    }

    button.active {
      border-color: transparent;
      color: #fff;
      background:
        linear-gradient(
          135deg,
          #743bde,
          #a153eb
        );
      box-shadow:
        0 7px 18px
        rgba(114, 55, 216, .22);
    }

    @media (max-width: 760px) {
      .filter-bar {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 470px) {
      .filter-group {
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class RankingFilterBarComponent {
    readonly period =
        input.required<StoryRankingPeriod>();

    readonly metric =
        input.required<StoryRankingMetric>();

    readonly periodChange =
        output<StoryRankingPeriod>();

    readonly metricChange =
        output<StoryRankingMetric>();

    protected readonly periods:
        readonly FilterOption<
            StoryRankingPeriod
        >[] = [
            {
                value: 'day',
                label: 'Ngày',
            },
            {
                value: 'week',
                label: 'Tuần',
            },
            {
                value: 'month',
                label: 'Tháng',
            },
            {
                value: 'all',
                label: 'Mọi lúc',
            },
        ];

    protected readonly metrics:
        readonly FilterOption<
            StoryRankingMetric
        >[] = [
            {
                value: 'popular',
                label: 'Phổ biến',
            },
            {
                value: 'rating',
                label: 'Đánh giá',
            },
            {
                value: 'followers',
                label: 'Theo dõi',
            },
            {
                value: 'trending',
                label: 'Mới nổi',
            },
        ];
}