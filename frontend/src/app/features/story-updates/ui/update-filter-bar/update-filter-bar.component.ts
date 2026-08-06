import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';

import { FormsModule } from '@angular/forms';

import { IconComponent } from '../../../../shared/components/icon/icon.component';

import {
    StoryUpdatesSort,
    StoryUpdatesTab,
} from '../../domain/story-updates.models';

interface TabOption {
    readonly value: StoryUpdatesTab;
    readonly label: string;
}

@Component({
    selector: 'app-update-filter-bar',
    standalone: true,
    imports: [
        FormsModule,
        IconComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <section class="filter-bar">
      <div
        class="tab-list"
        role="tablist"
        aria-label="Lọc truyện cập nhật"
      >
        @for (option of tabs; track option.value) {
          <button
            type="button"
            role="tab"
            [class.active]="tab() === option.value"
            [attr.aria-selected]="tab() === option.value"
            (click)="tabChange.emit(option.value)"
          >
            {{ option.label }}
          </button>
        }
      </div>

      <div class="sort-controls">
        <label>
          <select
            [ngModel]="sort()"
            (ngModelChange)="sortChange.emit($event)"
          >
            <option value="latest">Mới cập nhật</option>
            <option value="views">Nhiều lượt xem</option>
            <option value="title">A–Z</option>
          </select>

          <app-icon
            name="chevron-down"
            [size]="15"
          />
        </label>
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

    .tab-list {
      display: flex;
      align-items: center;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .tab-list::-webkit-scrollbar {
      display: none;
    }

    .tab-list button {
      min-height: 36px;
      padding: 0 16px;
      flex: 0 0 auto;
      border: 0;
      border-radius: 8px;
      color: #8d97ab;
      font-size: .875rem;
      font-weight: 600;
      cursor: pointer;
      background: transparent;
      transition: all 150ms ease;
    }

    .tab-list button:hover {
      color: #dcd7e6;
    }

    .tab-list button.active {
      color: #fff;
      background: linear-gradient(135deg, #743bde, #a153eb);
      box-shadow: 0 4px 14px rgba(104, 48, 190, .35);
    }

    .sort-controls label {
      position: relative;
      min-width: 150px;
      min-height: 36px;
      display: flex;
      align-items: center;
      border: 1px solid rgba(137, 149, 179, .18);
      border-radius: 8px;
      background: rgba(5, 10, 21, .5);
    }

    select {
      width: 100%;
      min-height: 36px;
      padding: 0 32px 0 12px;
      appearance: none;
      border: 0;
      outline: 0;
      color: #c2c7d2;
      font-size: .875rem;
      cursor: pointer;
      background: transparent;
    }

    select option {
      color: #e7e4ec;
      background: #101728;
    }

    label app-icon {
      position: absolute;
      right: 10px;
      color: #737d92;
      pointer-events: none;
    }

    @media (max-width: 680px) {
      .filter-bar {
        align-items: stretch;
        flex-direction: column;
      }

      .sort-controls label {
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

    protected readonly tabs: readonly TabOption[] = [
        { value: 'all', label: 'Tất cả' },
        { value: 'latest', label: 'Mới nhất' },
        { value: 'following', label: 'Theo dõi' },
        { value: 'hot', label: 'Hot' },
        { value: 'completed', label: 'Hoàn thành' },
    ];
}