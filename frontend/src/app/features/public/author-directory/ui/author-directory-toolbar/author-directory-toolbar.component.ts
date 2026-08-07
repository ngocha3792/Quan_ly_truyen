
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';

import { AuthorDirectorySort } from '../../domain/author-directory.models';

@Component({
    selector: 'app-author-directory-toolbar',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,

    template: `
    <section class="toolbar">
      <label class="search-box">
        <svg viewBox="0 0 24 24" aria-hidden="true">
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
          placeholder="Tìm kiếm tác giả..."
          (input)="handleQueryChange($event)"
        >
      </label>

      <label class="sort-select">
        <span>Sắp xếp:</span>

        <select
          [value]="sort"
          (change)="handleSortChange($event)"
        >
          <option value="featured">
            Đề xuất
          </option>

          <option value="followers">
            Nhiều người theo dõi
          </option>

          <option value="reads">
            Nhiều lượt đọc
          </option>

          <option value="works">
            Nhiều tác phẩm
          </option>

          <option value="name">
            Tên A–Z
          </option>
        </select>

        <svg
          class="select-chevron"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="m8 10 4 4 4-4"></path>
        </svg>
      </label>

      <div
        class="view-switch"
        aria-label="Kiểu hiển thị"
      >
        <button
          class="view-button view-button--active"
          type="button"
          aria-label="Hiển thị danh sách"
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

        <button
          class="view-button"
          type="button"
          aria-label="Hiển thị lưới"
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
      </div>
    </section>
  `,

    styles: [`
    :host {
      display: block;
    }

    .toolbar {
      display: grid;
      grid-template-columns:
        minmax(260px, 1fr)
        200px
        99px;
      gap: 14px;
      margin-bottom: 0;
    }

    .search-box,
    .sort-select,
    .view-switch {
      min-height: 43px;
      border: 1px solid rgba(132, 145, 177, 0.18);
      border-radius: 8px;
      background: rgba(5, 10, 21, 0.46);
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 14px;
    }

    .search-box svg {
      width: 18px;
      height: 18px;
      flex: 0 0 auto;
      color: var(--text-muted);
    }

    .search-box input {
      width: 100%;
      height: 41px;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--text-strong);
      font: inherit;
      font-size: 13.5px;
    }

    .search-box input::placeholder {
      color: var(--text-muted);
    }

    .sort-select {
      position: relative;
      display: flex;
      align-items: center;
    }

    .sort-select > span {
      padding-left: 13px;
      color: var(--text-secondary);
      font-size: 12.5px;
      white-space: nowrap;
    }

    .sort-select select {
      width: 100%;
      height: 41px;
      padding: 0 31px 0 6px;
      border: 0;
      outline: none;
      appearance: none;
      background: transparent;
      color: var(--text-strong);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }

    .sort-select option {
      color: #e7e4ec;
      background: #101728;
    }

    .select-chevron {
      position: absolute;
      right: 10px;
      width: 15px;
      height: 15px;
      pointer-events: none;
      color: #9099b1;
    }

    .view-switch {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4px;
      padding: 4px;
    }

    .view-button {
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #697388;
      cursor: pointer;
    }

    .view-button--active {
      background: rgba(125, 61, 204, 0.17);
      color: #c181ff;
      box-shadow: none;
    }

    .view-button svg {
      width: 19px;
      height: 19px;
    }

    .search-box svg,
    .sort-select svg,
    .view-button svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    @media (max-width: 700px) {
      .toolbar {
        grid-template-columns: 1fr 1fr;
      }

      .search-box {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 480px) {
      .toolbar {
        grid-template-columns: 1fr;
      }

      .search-box {
        grid-column: auto;
      }
    }
  `],
})
export class AuthorDirectoryToolbarComponent {
    @Input()
    query = '';

    @Input()
    sort: AuthorDirectorySort = 'featured';

    @Output()
    readonly queryChange =
        new EventEmitter<string>();

    @Output()
    readonly sortChange =
        new EventEmitter<AuthorDirectorySort>();

    handleQueryChange(event: Event): void {
        const input =
            event.target as HTMLInputElement;

        this.queryChange.emit(input.value);
    }

    handleSortChange(event: Event): void {
        const select =
            event.target as HTMLSelectElement;

        this.sortChange.emit(
            select.value as AuthorDirectorySort,
        );
    }
}