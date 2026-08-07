
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';

import {
    LibraryFilter,
    LibrarySort,
    LibraryViewMode,
} from '../../domain/my-library.models';

@Component({
    selector: 'app-library-toolbar',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,

    template: `
    <section class="library-toolbar">
      <label class="search-box">
        <svg viewBox="0 0 24 24">
          <circle
            cx="11"
            cy="11"
            r="7"
          ></circle>

          <path d="m16 16 5 5"></path>
        </svg>

        <input
          type="search"
          [value]="query"
          placeholder="Tìm trong thư viện..."
          (input)="handleQueryChange($event)"
        >
      </label>

      <div
        class="filter-list"
        aria-label="Lọc thư viện"
      >
        <button
          type="button"
          [class.active]="filter === 'all'"
          (click)="filterChange.emit('all')"
        >
          <svg viewBox="0 0 24 24">
            <rect
              x="4"
              y="4"
              width="6"
              height="6"
              rx="1"
            ></rect>

            <rect
              x="14"
              y="4"
              width="6"
              height="6"
              rx="1"
            ></rect>

            <rect
              x="4"
              y="14"
              width="6"
              height="6"
              rx="1"
            ></rect>

            <rect
              x="14"
              y="14"
              width="6"
              height="6"
              rx="1"
            ></rect>
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
            <path
              d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
            ></path>

            <circle
              cx="12"
              cy="12"
              r="2.5"
            ></circle>
          </svg>

          Theo dõi
        </button>

        <button
          type="button"
          [class.active]="filter === 'favorite'"
          (click)="filterChange.emit('favorite')"
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M12 21s-7-4.4-7-11a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 6.6-7 11-7 11Z"
            ></path>
          </svg>

          Yêu thích
        </button>

        <button
          type="button"
          [class.active]="filter === 'completed'"
          (click)="filterChange.emit('completed')"
        >
          <svg viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="9"
            ></circle>

            <path d="m8 12 2.5 2.5L16 9"></path>
          </svg>

          Đã hoàn thành
        </button>
      </div>

      <label class="sort-select">
        <select
          [value]="sort"
          (change)="handleSortChange($event)"
        >
          <option value="recent">
            Mới nhất
          </option>

          <option value="progress">
            Tiến độ cao nhất
          </option>

          <option value="chapter">
            Chương cao nhất
          </option>

          <option value="title">
            Tên truyện A–Z
          </option>
        </select>

        <svg viewBox="0 0 24 24">
          <path d="m8 10 4 4 4-4"></path>
        </svg>
      </label>

      <div class="view-switch">
        <button
          type="button"
          aria-label="Hiển thị dạng lưới"
          [class.active]="viewMode === 'grid'"
          (click)="viewModeChange.emit('grid')"
        >
          <svg viewBox="0 0 24 24">
            <rect
              x="4"
              y="4"
              width="6"
              height="6"
              rx="1"
            ></rect>

            <rect
              x="14"
              y="4"
              width="6"
              height="6"
              rx="1"
            ></rect>

            <rect
              x="4"
              y="14"
              width="6"
              height="6"
              rx="1"
            ></rect>

            <rect
              x="14"
              y="14"
              width="6"
              height="6"
              rx="1"
            ></rect>
          </svg>
        </button>

        <button
          type="button"
          aria-label="Hiển thị dạng danh sách"
          [class.active]="viewMode === 'list'"
          (click)="viewModeChange.emit('list')"
        >
          <svg viewBox="0 0 24 24">
            <path d="M9 6h11"></path>
            <path d="M9 12h11"></path>
            <path d="M9 18h11"></path>
            <path d="M4 6h.01"></path>
            <path d="M4 12h.01"></path>
            <path d="M4 18h.01"></path>
          </svg>
        </button>
      </div>
    </section>
  `,

    styles: [`
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

    .search-box,
    .sort-select,
    .view-switch {
      min-height: 44px;
      border: 1px solid var(--border);
      border-radius: 9px;
      background: rgba(8, 14, 28, 0.72);
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 14px;
    }

    .search-box svg {
      width: 19px;
      height: 19px;
      color: var(--text-muted);
    }

    .search-box input {
      width: 100%;
      height: 40px;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--text-strong);
      font: inherit;
      font-size: 14px;
    }

    .search-box input::placeholder {
      color: var(--text-muted);
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
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }

    .filter-list button.active {
      border-color: rgba(192, 132, 252, 0.38);
      background:
        linear-gradient(
          135deg,
          rgba(147, 51, 234, 0.85),
          rgba(109, 40, 217, 0.85)
        );
      color: #ffffff;
      box-shadow: 0 5px 15px rgba(126, 34, 206, 0.2);
    }

    .filter-list button svg {
      width: 17px;
      height: 17px;
    }

    .sort-select {
      position: relative;
    }

    .sort-select select {
      width: 100%;
      height: 42px;
      padding: 0 36px 0 14px;
      border: 0;
      outline: none;
      appearance: none;
      background: transparent;
      color: var(--text-strong);
      font: inherit;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
    }

    .sort-select option {
      background: #11182c;
      color: #ffffff;
    }

    .sort-select > svg {
      position: absolute;
      top: 50%;
      right: 12px;
      width: 17px;
      height: 17px;
      pointer-events: none;
      color: var(--text-muted);
      transform: translateY(-50%);
    }

    .view-switch {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      padding: 3px;
    }

    .view-switch button {
      display: grid;
      min-height: 36px;
      place-items: center;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
    }

    .view-switch button.active {
      background: rgba(126, 34, 206, 0.52);
      color: #e9d5ff;
    }

    .view-switch svg {
      width: 19px;
      height: 19px;
    }

    .library-toolbar svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
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

      .sort-select {
        grid-column: 1;
        grid-row: 2;
      }

      .view-switch {
        grid-column: 2;
        grid-row: 2;
      }

      .filter-list {
        grid-row: 3;
      }
    }
  `],
})
export class LibraryToolbarComponent {
    @Input()
    query = '';

    @Input()
    filter: LibraryFilter = 'all';

    @Input()
    sort: LibrarySort = 'recent';

    @Input()
    viewMode: LibraryViewMode = 'grid';

    @Output()
    readonly queryChange =
        new EventEmitter<string>();

    @Output()
    readonly filterChange =
        new EventEmitter<LibraryFilter>();

    @Output()
    readonly sortChange =
        new EventEmitter<LibrarySort>();

    @Output()
    readonly viewModeChange =
        new EventEmitter<LibraryViewMode>();

    handleQueryChange(event: Event): void {
        const input =
            event.target as HTMLInputElement;

        this.queryChange.emit(input.value);
    }

    handleSortChange(event: Event): void {
        const select =
            event.target as HTMLSelectElement;

        this.sortChange.emit(
            select.value as LibrarySort,
        );
    }
}