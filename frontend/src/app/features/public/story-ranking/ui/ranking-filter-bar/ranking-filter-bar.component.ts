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

  templateUrl: './ranking-filter-bar.component.html',

  styleUrl: './ranking-filter-bar.component.scss',
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
