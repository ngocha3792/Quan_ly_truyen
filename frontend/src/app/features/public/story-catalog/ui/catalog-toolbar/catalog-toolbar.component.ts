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

  template: `
    <div class="toolbar">
      <app-search-field
        class="catalog-search"
        [value]="query()"
        placeholder="Tìm kiếm truyện, tác giả..."
        ariaLabel="Tìm kiếm truyện hoặc tác giả"
        (valueChange)="queryChange.emit($event)"
      />

      <app-sort-select
        class="catalog-sort"
        [options]="sortOptions"
        [value]="sort()"
        (valueChange)="sortChange.emit($event)"
      />

      <app-view-mode-toggle
        class="catalog-view-mode"
        [value]="viewMode()"
        (valueChange)="viewModeChange.emit($event)"
      />
    </div>
  `,

  styles: `
    .toolbar {
      display: grid;

      grid-template-columns:
        minmax(240px, 1fr)
        178px
        auto;

      gap: 11px;

      align-items: center;
    }

    .catalog-search {
      --search-placeholder-color: #667084;
    }

    .catalog-view-mode {
      width: max-content;
    }

    @media (max-width: 680px) {
      .toolbar {
        grid-template-columns: 1fr;
      }
    }
  `,
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
