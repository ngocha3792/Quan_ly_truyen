import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { SearchFieldComponent } from '../../../../../shared/components/search-field/search-field.component';

import {
  SortOption,
  SortSelectComponent,
} from '../../../../../shared/components/sort-select/sort-select.component';

import { ViewModeToggleComponent } from '../../../../../shared/components/view-mode-toggle/view-mode-toggle.component';

import { StoryCatalogSort, StoryCatalogViewMode } from '../../domain/story-catalog.models';

@Component({
  selector: 'app-catalog-toolbar',

  standalone: true,

  imports: [SearchFieldComponent, SortSelectComponent, ViewModeToggleComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './catalog-toolbar.component.html',

  styleUrl: './catalog-toolbar.component.scss',
})
export class CatalogToolbarComponent {
  protected readonly sortOptions: readonly SortOption<StoryCatalogSort>[] = [
    {
      value: 'latest',
      label: 'Mới cập nhật',
    },
    {
      value: 'popular',
      label: 'Xem nhiều nhất',
    },
    {
      value: 'rating',
      label: 'Đánh giá cao',
    },
    {
      value: 'chapter-count',
      label: 'Nhiều chương nhất',
    },
    {
      value: 'oldest',
      label: 'Cập nhật cũ nhất',
    },
  ];

  readonly query = input('');

  readonly sort = input<StoryCatalogSort>('latest');

  readonly viewMode = input<StoryCatalogViewMode>('grid');

  readonly queryChange = output<string>();

  readonly sortChange = output<StoryCatalogSort>();

  readonly viewModeChange = output<StoryCatalogViewMode>();
}
