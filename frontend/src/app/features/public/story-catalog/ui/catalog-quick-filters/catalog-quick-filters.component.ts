import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { StoryGenre, StoryPublicationStatus } from '../../domain/story-catalog.models';

@Component({
  selector: 'app-catalog-quick-filters',

  standalone: true,

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './catalog-quick-filters.component.html',

  styleUrl: './catalog-quick-filters.component.scss',
})
export class CatalogQuickFiltersComponent {
  readonly genres = input.required<readonly StoryGenre[]>();

  readonly selectedGenre = input<string | null>(null);

  readonly status = input<StoryPublicationStatus | 'all'>('all');

  readonly genreChange = output<string | null>();

  readonly statusChange = output<StoryPublicationStatus | 'all'>();
}
