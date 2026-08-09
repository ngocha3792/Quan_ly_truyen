import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { GenreSummary } from '../../domain/genre-discovery.models';

@Component({
  selector: 'app-genre-quick-filter',

  standalone: true,

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './genre-quick-filter.component.html',

  styleUrl: './genre-quick-filter.component.scss',
})
export class GenreQuickFilterComponent {
  readonly genres = input.required<readonly GenreSummary[]>();

  readonly selectedSlug = input<string | null>(null);

  readonly selectedSlugChange = output<string | null>();
}
