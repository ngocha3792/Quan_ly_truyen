import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { SearchFieldComponent } from '../../../../../shared/components/search-field/search-field.component';
import { SortOption } from '../../../../../shared/components/sort-select/sort-select.component';

import { AuthorDirectorySort } from '../../domain/author-directory.models';

@Component({
  selector: 'app-author-directory-toolbar',

  standalone: true,

  imports: [SearchFieldComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './author-directory-toolbar.component.html',

  styleUrl: './author-directory-toolbar.component.scss',
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
