import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { GenreRankingDistribution } from '../../domain/story-ranking.models';

@Component({
  selector: 'app-genre-distribution-card',

  standalone: true,

  imports: [RouterLink],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './genre-distribution-card.component.html',

  styleUrl: './genre-distribution-card.component.scss',
})
export class GenreDistributionCardComponent {
  readonly genres = input.required<readonly GenreRankingDistribution[]>();
}
