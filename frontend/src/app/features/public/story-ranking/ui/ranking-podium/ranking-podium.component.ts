import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { StoryRankingItem } from '../../domain/story-ranking.models';

import { TopRankingCardComponent } from '../top-ranking-card/top-ranking-card.component';

@Component({
  selector: 'app-ranking-podium',

  standalone: true,

  imports: [TopRankingCardComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './ranking-podium.component.html',

  styleUrl: './ranking-podium.component.scss',
})
export class RankingPodiumComponent {
  readonly stories = input.required<readonly StoryRankingItem[]>();
}
