import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-pagination',

  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    @if (totalPages() > 1) {
      <nav class="pagination" aria-label="Phân trang">
        <button
          type="button"
          aria-label="Trang trước"
          [disabled]="page() <= 1"
          (click)="pageChange.emit(page() - 1)"
        >
          <app-icon name="chevron-left" [size]="16" />
        </button>

        @if (showFirstPage()) {
          <button type="button" [class.active]="page() === 1" (click)="pageChange.emit(1)">
            1
          </button>

          @if (visiblePages()[0] > 2) {
            <span>…</span>
          }
        }

        @for (item of visiblePages(); track item) {
          <button
            type="button"
            [class.active]="item === page()"
            [attr.aria-current]="item === page() ? 'page' : null"
            (click)="pageChange.emit(item)"
          >
            {{ item }}
          </button>
        }

        @if (showLastPage()) {
          @if (visiblePages()[visiblePages().length - 1] < totalPages() - 1) {
            <span>…</span>
          }

          <button
            type="button"
            [class.active]="page() === totalPages()"
            (click)="pageChange.emit(totalPages())"
          >
            {{ totalPages() }}
          </button>
        }

        <button
          type="button"
          aria-label="Trang sau"
          [disabled]="page() >= totalPages()"
          (click)="pageChange.emit(page() + 1)"
        >
          <app-icon name="chevron-right" [size]="16" />
        </button>
      </nav>
    }
  `,

  styles: `
    :host {
      display: block;
    }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
    }

    button {
      min-width: 34px;
      height: 34px;
      padding: 0 9px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(132, 145, 177, 0.17);
      border-radius: 7px;
      color: #939caf;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      background: rgba(19, 27, 46, 0.78);
      transition:
        color 160ms ease,
        border-color 160ms ease,
        background 160ms ease;
    }

    button:hover:not(:disabled) {
      color: #fff;
      border-color: rgba(163, 99, 242, 0.4);
    }

    button.active {
      border-color: transparent;
      color: #fff;
      background: linear-gradient(135deg, #743bde, #a153eb);
      box-shadow: 0 8px 22px rgba(114, 55, 216, 0.28);
    }

    button:disabled {
      opacity: 0.38;
      cursor: not-allowed;
    }

    span {
      color: #646e82;
      font-size: 11px;
    }
  `,
})
export class PaginationComponent {
  readonly page = input(1);
  readonly totalPages = input(1);
  readonly siblingCount = input(2);

  readonly pageChange = output<number>();

  readonly visiblePages = computed(() => {
    const current = this.page();
    const total = this.totalPages();

    const start = Math.max(2, current - this.siblingCount());

    const end = Math.min(total - 1, current + this.siblingCount());

    const pages: number[] = [];

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    if (total <= 7) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    return pages;
  });

  readonly showFirstPage = computed(() => this.totalPages() > 7);

  readonly showLastPage = computed(() => this.totalPages() > 7);
}
