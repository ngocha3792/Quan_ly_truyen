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

  template: `
    <section class="library-toolbar">
      <app-search-field
        class="library-search"
        [value]="query"
        placeholder="Tìm trong thư viện..."
        ariaLabel="Tìm trong thư viện"
        [iconSize]="19"
        (valueChange)="queryChange.emit($event)"
      />

      <div class="filter-list" aria-label="Lọc thư viện">
        <button type="button" [class.active]="filter === 'all'" (click)="filterChange.emit('all')">
          <svg viewBox="0 0 24 24">
            <rect x="4" y="4" width="6" height="6" rx="1"></rect>

            <rect x="14" y="4" width="6" height="6" rx="1"></rect>

            <rect x="4" y="14" width="6" height="6" rx="1"></rect>

            <rect x="14" y="14" width="6" height="6" rx="1"></rect>
          </svg>

          Tất cả
        </button>

        <button
          type="button"
          [class.active]="filter === 'reading'"
          (click)="filterChange.emit('reading')"
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"
            ></path>

            <path d="M8 8h8"></path>
          </svg>

          Đang đọc
        </button>

        <button
          type="button"
          [class.active]="filter === 'following'"
          (click)="filterChange.emit('following')"
        >
          <svg viewBox="0 0 24 24">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path>

            <circle cx="12" cy="12" r="2.5"></circle>
          </svg>

          Theo dõi
        </button>

        <button
          type="button"
          [class.active]="filter === 'favorite'"
          (click)="filterChange.emit('favorite')"
        >
          <svg viewBox="0 0 24 24">
            <path d="M12 21s-7-4.4-7-11a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 6.6-7 11-7 11Z"></path>
          </svg>

          Yêu thích
        </button>

        <button
          type="button"
          [class.active]="filter === 'completed'"
          (click)="filterChange.emit('completed')"
        >
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9"></circle>

            <path d="m8 12 2.5 2.5L16 9"></path>
          </svg>

          Đã hoàn thành
        </button>
      </div>

      <app-sort-select
        class="library-sort"
        [options]="sortOptions"
        [value]="sort"
        (valueChange)="sortChange.emit($event)"
      />

      <app-view-mode-toggle
        class="library-view-mode"
        [value]="viewMode"
        (valueChange)="viewModeChange.emit($event)"
      />
    </section>
  `,

  styles: [
    `
      :host {
        display: block;
      }

      .library-toolbar {
        display: grid;

        grid-template-columns:
          260px
          minmax(320px, 1fr)
          175px
          88px;

        align-items: center;

        gap: 14px;

        padding: 16px 20px;

        border-bottom: 1px solid var(--border);
      }

      .library-search {
        --search-min-height: 44px;

        --search-input-height: 40px;

        --search-radius: 9px;

        --search-border: 1px solid var(--border);

        --search-background: rgba(8, 14, 28, 0.72);

        --search-padding: 0 14px;

        --search-gap: 10px;

        --search-color: var(--text-strong);

        --search-font-size: 14px;

        --search-icon-color: var(--text-muted);

        --search-placeholder-color: var(--text-muted);
      }

      .filter-list {
        display: flex;

        min-width: 0;

        align-items: center;

        gap: 7px;

        overflow-x: auto;
      }

      .filter-list button {
        display: inline-flex;

        min-height: 40px;

        flex: 0 0 auto;

        align-items: center;

        gap: 7px;

        padding: 7px 16px;

        border: 1px solid var(--border);

        border-radius: 999px;

        background: rgba(8, 14, 28, 0.45);

        color: var(--text-secondary);

        font: inherit;

        font-size: 13.5px;

        font-weight: 600;

        cursor: pointer;
      }

      .filter-list button.active {
        border-color: rgba(192, 132, 252, 0.38);

        color: #fff;

        background: linear-gradient(135deg, rgba(147, 51, 234, 0.85), rgba(109, 40, 217, 0.85));

        box-shadow: 0 5px 15px rgba(126, 34, 206, 0.2);
      }

      .filter-list button svg {
        width: 17px;
        height: 17px;

        fill: none;

        stroke: currentColor;

        stroke-width: 1.8;

        stroke-linecap: round;

        stroke-linejoin: round;
      }

      .library-sort {
        --sort-min-height: 44px;

        --sort-select-height: 42px;

        --sort-border: 1px solid var(--border);

        --sort-radius: 9px;

        --sort-background: rgba(8, 14, 28, 0.72);

        --sort-color: var(--text-strong);

        --sort-font-size: 13.5px;

        --sort-font-weight: 600;

        --sort-option-background: #11182c;

        --sort-option-color: #fff;

        --sort-icon-color: var(--text-muted);

        --sort-icon-right: 12px;

        --sort-padding: 0 36px 0 14px;
      }

      .library-view-mode {
        --view-toggle-min-height: 44px;

        --view-toggle-border: 1px solid var(--border);

        --view-toggle-radius: 9px;

        --view-toggle-background: rgba(8, 14, 28, 0.72);

        --view-toggle-padding: 3px;

        --view-toggle-button-height: 36px;

        --view-toggle-color: var(--text-muted);

        --view-toggle-active-color: #e9d5ff;

        --view-toggle-active-background: rgba(126, 34, 206, 0.52);
      }

      @media (max-width: 1100px) {
        .library-toolbar {
          grid-template-columns:
            minmax(240px, 1fr)
            155px
            82px;
        }

        .filter-list {
          grid-column: 1 / -1;

          grid-row: 2;
        }
      }

      @media (max-width: 600px) {
        .library-toolbar {
          grid-template-columns: 1fr 75px;
        }

        .library-sort {
          grid-column: 1;
          grid-row: 2;
        }

        .library-view-mode {
          grid-column: 2;
          grid-row: 2;
        }

        .filter-list {
          grid-row: 3;
        }
      }
    `,
  ],
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
