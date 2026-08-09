import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import {
  SortSelectComponent,
  SortOption,
} from '../../../../../shared/components/sort-select/sort-select.component';
import {
  TabFilterComponent,
  TabFilterOption,
} from '../../../../../shared/components/tab-filter/tab-filter.component';

import { StoryUpdatesSort, StoryUpdatesTab } from '../../domain/story-updates.models';

@Component({
  selector: 'app-update-filter-bar',
  standalone: true,
  imports: [TabFilterComponent, SortSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './update-filter-bar.component.html',
  styleUrl: './update-filter-bar.component.scss',
})
export class UpdateFilterBarComponent {
  readonly tab = input.required<StoryUpdatesTab>();
  readonly sort = input.required<StoryUpdatesSort>();

  readonly tabChange = output<StoryUpdatesTab>();
  readonly sortChange = output<StoryUpdatesSort>();

  protected readonly tabs: readonly TabFilterOption<StoryUpdatesTab>[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'latest', label: 'Mới nhất' },
    { value: 'following', label: 'Theo dõi' },
    { value: 'hot', label: 'Hot' },
    { value: 'completed', label: 'Hoàn thành' },
  ];

  protected readonly sortOptions: readonly SortOption<StoryUpdatesSort>[] = [
    { value: 'latest', label: 'Mới cập nhật' },
    { value: 'views', label: 'Nhiều lượt xem' },
    { value: 'title', label: 'A–Z' },
  ];
}
