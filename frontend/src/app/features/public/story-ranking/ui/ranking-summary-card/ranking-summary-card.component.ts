import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconComponent, IconName } from '../../../../../shared/components/icon/icon.component';

import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';

import { StoryRankingSummary } from '../../domain/story-ranking.models';

interface SummaryRow {
  readonly label: string;
  readonly value: number;

  readonly icon: IconName;
  readonly tone: 'purple' | 'orange' | 'blue';

  readonly change: number;
  readonly suffix: string;
}

@Component({
  selector: 'app-ranking-summary-card',

  standalone: true,

  imports: [IconComponent, CompactNumberPipe],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './ranking-summary-card.component.html',

  styleUrl: './ranking-summary-card.component.scss',
})
export class RankingSummaryCardComponent {
  readonly summary = input.required<StoryRankingSummary>();

  protected rows(): readonly SummaryRow[] {
    const summary = this.summary();

    return [
      {
        label: 'Tổng lượt đọc',

        value: summary.totalReads,

        icon: 'book',
        tone: 'purple',

        change: summary.totalReadsChangePercent,

        suffix: '%',
      },
      {
        label: 'Truyện đang hot',

        value: summary.hotStoryCount,

        icon: 'fire',
        tone: 'orange',

        change: summary.hotStoryChange,

        suffix: '',
      },
      {
        label: 'Tổng người theo dõi',

        value: summary.followerCount,

        icon: 'users',
        tone: 'blue',

        change: summary.followerChangePercent,

        suffix: '%',
      },
    ];
  }
}
