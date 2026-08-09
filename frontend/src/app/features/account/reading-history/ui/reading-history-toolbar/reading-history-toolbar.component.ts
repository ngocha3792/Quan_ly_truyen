import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { SearchFieldComponent } from '../../../../../shared/components/search-field/search-field.component';

import {
  SortOption,
  SortSelectComponent,
} from '../../../../../shared/components/sort-select/sort-select.component';

import {
  TabFilterComponent,
  TabFilterOption,
} from '../../../../../shared/components/tab-filter/tab-filter.component';

import { ReadingHistoryPeriod, ReadingHistorySort } from '../../domain/reading-history.models';

@Component({
  selector: 'app-reading-history-toolbar',

  standalone: true,

  imports: [SearchFieldComponent, SortSelectComponent, TabFilterComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './reading-history-toolbar.component.html',

  styleUrl: './reading-history-toolbar.component.scss',
})
export class ReadingHistoryToolbarComponent {
  protected readonly periodOptions: readonly TabFilterOption<ReadingHistoryPeriod>[] = [
    {
      value: 'all',
      label: 'Tất cả',
    },
    {
      value: 'today',
      label: 'Hôm nay',
    },
    {
      value: '7-days',
      label: '7 ngày',
    },
    {
      value: '30-days',
      label: '30 ngày',
    },
  ];

  protected readonly sortOptions: readonly SortOption<ReadingHistorySort>[] = [
    {
      value: 'recent',
      label: 'Mới đọc gần đây',
    },
    {
      value: 'progress',
      label: 'Tiến độ cao nhất',
    },
    {
      value: 'title',
      label: 'Tên truyện A–Z',
    },
  ];

  @Input()
  query = '';

  @Input()
  period: ReadingHistoryPeriod = 'all';

  @Input()
  sort: ReadingHistorySort = 'recent';

  @Output()
  readonly queryChange = new EventEmitter<string>();

  @Output()
  readonly periodChange = new EventEmitter<ReadingHistoryPeriod>();

  @Output()
  readonly sortChange = new EventEmitter<ReadingHistorySort>();
}
