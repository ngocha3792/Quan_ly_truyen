import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { SearchFieldComponent } from '../../../../../shared/components/search-field/search-field.component';
import { SortOption } from '../../../../../shared/components/sort-select/sort-select.component';

import { AuthorDirectorySort } from '../../domain/author-directory.models';

@Component({
  selector: 'app-author-directory-toolbar',

  standalone: true,

  imports: [SearchFieldComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <app-search-field
      class="author-search"
      [value]="query"
      placeholder="Tìm kiếm tác giả..."
      ariaLabel="Tìm kiếm tác giả"
      [iconSize]="18"
      (valueChange)="queryChange.emit($event)"
    />
  `,

  styles: [
    `
      .author-search {
        --search-min-height: 43px;

        --search-input-height: 41px;

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

      @media (max-width: 480px) {
        .toolbar {
          grid-template-columns: 1fr;
        }

        .search-box {
          grid-column: auto;
        }
      }
    `,
  ],
})
export class AuthorDirectoryToolbarComponent {
  protected readonly sortOptions: readonly SortOption<AuthorDirectorySort>[] = [
    {
      value: 'featured',
      label: 'Đề xuất',
    },
    {
      value: 'followers',
      label: 'Nhiều người theo dõi',
    },
    {
      value: 'reads',
      label: 'Nhiều lượt đọc',
    },
    {
      value: 'works',
      label: 'Nhiều tác phẩm',
    },
    {
      value: 'name',
      label: 'Tên A–Z',
    },
  ];

  @Input()
  query = '';

  @Input()
  sort: AuthorDirectorySort = 'featured';

  @Output()
  readonly queryChange = new EventEmitter<string>();

  @Output()
  readonly sortChange = new EventEmitter<AuthorDirectorySort>();

  handleQueryChange(event: Event): void {
    const input = event.target as HTMLInputElement;

    this.queryChange.emit(input.value);
  }
}
