import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { StoryCatalogItem, StoryCatalogViewMode } from '../../domain/story-catalog.models';

import { StoryCatalogCardComponent } from '../story-catalog-card/story-catalog-card.component';

@Component({
  selector: 'app-story-catalog-grid',

  standalone: true,

  imports: [EmptyStateComponent, StoryCatalogCardComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './story-catalog-grid.component.html',

  styleUrl: './story-catalog-grid.component.scss',
})
export class StoryCatalogGridComponent {
  readonly stories = input.required<readonly StoryCatalogItem[]>();

  readonly viewMode = input<StoryCatalogViewMode>('grid');

  readonly loading = input(false);

  protected readonly skeletonItems = Array.from({ length: 12 }, (_, index) => index);
}
