import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { SearchFieldComponent } from '../../../../../shared/components/search-field/search-field.component';

import {
  SortOption,
  SortSelectComponent,
} from '../../../../../shared/components/sort-select/sort-select.component';

import { ViewModeToggleComponent } from '../../../../../shared/components/view-mode-toggle/view-mode-toggle.component';

import { LibraryFilter, LibrarySort, LibraryViewMode } from '../../domain/my-library.models';

@Component({
  selector: 'app-library-toolbar',

  standalone: true,

  imports: [SearchFieldComponent, SortSelectComponent, ViewModeToggleComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './library-toolbar.component.html',

  styleUrl: './library-toolbar.component.scss',
})
export class LibraryToolbarComponent {
  protected readonly sortOptions: readonly SortOption<LibrarySort>[] = [
    {
      value: 'recent',
      label: 'Mới nhất',
    },
    {
      value: 'progress',
      label: 'Tiến độ cao nhất',
    },
    {
      value: 'chapter',
      label: 'Chương cao nhất',
    },
    {
      value: 'title',
      label: 'Tên truyện A–Z',
    },
  ];

  @Input()
  query = '';

  @Input()
  filter: LibraryFilter = 'all';

  @Input()
  sort: LibrarySort = 'recent';

  @Input()
  viewMode: LibraryViewMode = 'grid';

  @Output()
  readonly queryChange = new EventEmitter<string>();

  @Output()
  readonly filterChange = new EventEmitter<LibraryFilter>();

  @Output()
  readonly sortChange = new EventEmitter<LibrarySort>();

  @Output()
  readonly viewModeChange = new EventEmitter<LibraryViewMode>();
}
