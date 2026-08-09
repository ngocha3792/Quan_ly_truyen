import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { GenreRankingItem, GenreSummary } from '../../domain/genre-discovery.models';

import { GenreGridCardComponent } from '../genre-grid-card/genre-grid-card.component';

@Component({
  selector: 'app-genre-grid',

  standalone: true,

  imports: [EmptyStateComponent, GenreGridCardComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './genre-grid.component.html',

  styleUrl: './genre-grid.component.scss',
})
export class GenreGridComponent {
  readonly genres = input.required<readonly GenreSummary[]>();

  readonly ranking = input.required<readonly GenreRankingItem[]>();

  readonly loading = input(false);

  readonly selected = input(false);

  protected readonly skeletons = Array.from({ length: 12 }, (_, index) => index);

  protected findRank(slug: string): number | null {
    return this.ranking().find((item) => item.slug === slug && item.rank <= 3)?.rank ?? null;
  }
}
