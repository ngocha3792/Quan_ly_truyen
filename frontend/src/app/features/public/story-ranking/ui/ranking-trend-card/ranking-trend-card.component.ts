import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';

import { StoryRankingTrend } from '../../domain/story-ranking.models';

@Component({
  selector: 'app-ranking-trend-card',

  standalone: true,

  imports: [RouterLink, CompactNumberPipe],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './ranking-trend-card.component.html',

  styleUrl: './ranking-trend-card.component.scss',
})
export class RankingTrendCardComponent {
  readonly trends = input.required<readonly StoryRankingTrend[]>();

  protected getWidth(item: StoryRankingTrend): number {
    if (item.maximumValue <= 0) {
      return 0;
    }

    return Math.max(4, Math.min(100, (item.value / item.maximumValue) * 100));
  }
}
