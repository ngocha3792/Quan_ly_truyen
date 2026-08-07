import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';

import { SortSelectComponent, SortOption } from '../../../../../shared/components/sort-select/sort-select.component';
import { TabFilterComponent, TabFilterOption } from '../../../../../shared/components/tab-filter/tab-filter.component';

import {
    StoryUpdatesSort,
    StoryUpdatesTab,
} from '../../domain/story-updates.models';

@Component({
    selector: 'app-update-filter-bar',
    standalone: true,
    imports: [
        TabFilterComponent,
        SortSelectComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <section class="filter-bar">
      <app-tab-filter
        [options]="$any(tabs)"
        [selected]="tab()"
        ariaLabel="Lọc truyện cập nhật"
        (selectedChange)="tabChange.emit($event)"
      />

      <div class="sort-controls">
        <app-sort-select
          [options]="$any(sortOptions)"
          [value]="sort()"
          (valueChange)="sortChange.emit($event)"
        />
      </div>
    </section>
  `,
    styles: `
    .filter-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 8px;
      border: 1px solid var(--border, rgba(132, 145, 177, .16));
      border-radius: 10px;
      background: rgba(11, 17, 31, .8);
    }

    .sort-controls {
      flex: 0 0 auto;
      min-width: 150px;
    }

    @media (max-width: 680px) {
      .filter-bar {
        align-items: stretch;
        flex-direction: column;
      }

      .sort-controls {
        width: 100%;
      }
    }
  `,
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