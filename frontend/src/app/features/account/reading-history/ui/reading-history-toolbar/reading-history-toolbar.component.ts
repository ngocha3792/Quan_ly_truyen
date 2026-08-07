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

  template: `
    <section class="history-toolbar">
      <app-search-field
        class="history-search"
        [value]="query"
        placeholder="Tìm trong lịch sử đọc..."
        ariaLabel="Tìm trong lịch sử đọc"
        [iconSize]="18"
        (valueChange)="queryChange.emit($event)"
      />

      <app-tab-filter
        class="period-filter"
        ariaLabel="Lọc lịch sử theo thời gian"
        [options]="periodOptions"
        [selected]="period"
        (selectedChange)="periodChange.emit($event)"
      />

      <app-sort-select
        class="history-sort"
        [options]="sortOptions"
        [value]="sort"
        (valueChange)="sortChange.emit($event)"
      />
    </section>
  `,

  styles: [
    `
      :host {
        display: block;
      }

      .history-toolbar {
        display: grid;

        grid-template-columns:
          minmax(230px, 1fr)
          auto
          185px;

        gap: 14px;

        align-items: center;

        padding: 1rem 1.25rem;

        border-bottom: 1px solid var(--border);
      }

      .history-search {
        --search-min-height: 42px;

        --search-input-height: 40px;

        --search-radius: 8px;

        --search-border: 1px solid rgba(132, 145, 177, 0.18);

        --search-background: rgba(5, 10, 21, 0.46);

        --search-padding: 0 14px;

        --search-gap: 10px;

        --search-color: var(--text-strong);

        --search-font-size: 13.5px;

        --search-icon-color: var(--text-muted);

        --search-placeholder-color: var(--text-muted);
      }

      .period-filter {
        --tab-wrap: nowrap;

        --tab-gap: 4px;

        --tab-container-padding: 4px;

        --tab-container-border: 1px solid rgba(132, 145, 177, 0.18);

        --tab-container-radius: 999px;

        --tab-container-background: rgba(5, 10, 21, 0.46);

        --tab-min-height: 34px;

        --tab-padding: 0 14px;

        --tab-border: 0;

        --tab-radius: 999px;

        --tab-background: transparent;

        --tab-color: var(--text-secondary);

        --tab-font-size: 12.5px;

        --tab-font-weight: 600;

        --tab-active-background: linear-gradient(135deg, var(--primary), #7c3aed);

        --tab-active-shadow: 0 4px 14px rgba(126, 34, 206, 0.25);
      }

      .history-sort {
        --sort-min-height: 42px;

        --sort-select-height: 40px;

        --sort-color: var(--text-strong);

        --sort-font-size: 13px;

        --sort-icon-color: var(--text-muted);

        --sort-padding: 0 34px 0 12px;
      }

      @media (max-width: 820px) {
        .history-toolbar {
          grid-template-columns: 1fr 185px;
        }

        .period-filter {
          grid-column: 1 / -1;

          grid-row: 2;

          justify-self: start;
        }
      }

      @media (max-width: 540px) {
        .history-toolbar {
          grid-template-columns: 1fr;
        }

        .period-filter {
          grid-column: auto;

          grid-row: auto;

          width: 100%;

          --tab-overflow-x: auto;

          --tab-flex: 1 0 auto;
        }
      }
    `,
  ],
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
