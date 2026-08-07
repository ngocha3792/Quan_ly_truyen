
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';

import {
    ReadingHistoryPeriod,
    ReadingHistorySort,
} from '../../domain/reading-history.models';

@Component({
    selector: 'app-reading-history-toolbar',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,

    template: `
    <section class="history-toolbar">
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
          placeholder="Tìm trong lịch sử đọc..."
          (input)="handleQueryChange($event)"
        >
      </label>

      <div
        class="period-filter"
        aria-label="Lọc lịch sử theo thời gian"
      >
        <button
          type="button"
          [class.period-button--active]="
            period === 'all'
          "
          (click)="periodChange.emit('all')"
        >
          Tất cả
        </button>

        <button
          type="button"
          [class.period-button--active]="
            period === 'today'
          "
          (click)="periodChange.emit('today')"
        >
          Hôm nay
        </button>

        <button
          type="button"
          [class.period-button--active]="
            period === '7-days'
          "
          (click)="periodChange.emit('7-days')"
        >
          7 ngày
        </button>

        <button
          type="button"
          [class.period-button--active]="
            period === '30-days'
          "
          (click)="periodChange.emit('30-days')"
        >
          30 ngày
        </button>
      </div>

      <label class="sort-select">
        <select
          [value]="sort"
          (change)="handleSortChange($event)"
        >
          <option value="recent">
            Mới đọc gần đây
          </option>

          <option value="progress">
            Tiến độ cao nhất
          </option>

          <option value="title">
            Tên truyện A–Z
          </option>
        </select>

        <svg viewBox="0 0 24 24">
          <path d="m8 10 4 4 4-4"></path>
        </svg>
      </label>
    </section>
  `,

    styles: [`
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

    .search-box,
    .sort-select {
      min-height: 42px;
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
      font-size: 13.5px;
    }

    .search-box input::placeholder {
      color: var(--text-muted);
    }

    .period-filter {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      border: 1px solid rgba(132, 145, 177, 0.18);
      border-radius: 999px;
      background: rgba(5, 10, 21, 0.46);
    }

    .period-filter button {
      min-height: 34px;
      padding: 0 14px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--text-secondary);
      font: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: color 0.2s ease;
    }

    .period-filter .period-button--active {
      background:
        linear-gradient(
          135deg,
          var(--primary),
          #7c3aed
        );
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(126, 34, 206, 0.25);
    }

    .sort-select {
      position: relative;
    }

    .sort-select select {
      width: 100%;
      height: 40px;
      padding: 0 34px 0 12px;
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

    .sort-select svg {
      position: absolute;
      top: 50%;
      right: 11px;
      width: 15px;
      height: 15px;
      pointer-events: none;
      color: var(--text-muted);
      transform: translateY(-50%);
    }

    .history-toolbar svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
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
        overflow-x: auto;
      }

      .period-filter button {
        flex: 1 0 auto;
      }
    }
  `],
})
export class ReadingHistoryToolbarComponent {
    @Input()
    query = '';

    @Input()
    period: ReadingHistoryPeriod = 'all';

    @Input()
    sort: ReadingHistorySort = 'recent';

    @Output()
    readonly queryChange =
        new EventEmitter<string>();

    @Output()
    readonly periodChange =
        new EventEmitter<ReadingHistoryPeriod>();

    @Output()
    readonly sortChange =
        new EventEmitter<ReadingHistorySort>();

    handleQueryChange(event: Event): void {
        const input =
            event.target as HTMLInputElement;

        this.queryChange.emit(input.value);
    }

    handleSortChange(event: Event): void {
        const select =
            event.target as HTMLSelectElement;

        this.sortChange.emit(
            select.value as ReadingHistorySort,
        );
    }
}