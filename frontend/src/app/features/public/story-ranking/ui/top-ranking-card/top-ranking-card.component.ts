import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';

import { StoryRankingItem } from '../../domain/story-ranking.models';

import { RankMovementComponent } from '../rank-movement/rank-movement.component';

export type TopRankingVariant = 'first' | 'second' | 'third';

@Component({
  selector: 'app-top-ranking-card',

  standalone: true,

  imports: [RouterLink, IconComponent, CompactNumberPipe, RankMovementComponent],

  templateUrl: './top-ranking-card.component.html',

  styleUrl: './top-ranking-card.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopRankingCardComponent {
  readonly story = input.required<StoryRankingItem>();

  readonly variant = input.required<TopRankingVariant>();
}
