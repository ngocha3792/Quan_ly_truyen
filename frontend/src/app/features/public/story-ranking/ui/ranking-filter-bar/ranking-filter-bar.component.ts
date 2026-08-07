import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import {
  TabFilterComponent,
  TabFilterOption,
} from '../../../../../shared/components/tab-filter/tab-filter.component';

import { StoryRankingMetric, StoryRankingPeriod } from '../../domain/story-ranking.models';

@Component({
  selector: 'app-ranking-filter-bar',

  standalone: true,

  imports: [TabFilterComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="filter-bar">
      <app-tab-filter
        [options]="$any(periods)"
        [selected]="period()"
        ariaLabel="Khoảng thời gian"
        (selectedChange)="periodChange.emit($event)"
      />

      <app-tab-filter
        [options]="$any(metrics)"
        [selected]="metric()"
        ariaLabel="Tiêu chí xếp hạng"
        (selectedChange)="metricChange.emit($event)"
      />
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
      gap: 2rem;
    }

    @media (max-width: 760px) {
      .filter-bar {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `,
})
export class RankingFilterBarComponent {
  readonly period = input.required<StoryRankingPeriod>();

  readonly metric = input.required<StoryRankingMetric>();

  readonly periodChange = output<StoryRankingPeriod>();

  readonly metricChange = output<StoryRankingMetric>();

  protected readonly periods: readonly TabFilterOption<StoryRankingPeriod>[] = [
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

  protected readonly metrics: readonly TabFilterOption<StoryRankingMetric>[] = [
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
