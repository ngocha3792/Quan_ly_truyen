import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-pagination',

  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './pagination.component.html',

  styleUrl: './pagination.component.scss',
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
