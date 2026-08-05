import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';

import { FormsModule } from '@angular/forms';

import { IconComponent } from '../../../../shared/components/icon/icon.component';

import {
    StoryCatalogSort,
    StoryCatalogViewMode,
} from '../../domain/story-catalog.models';

@Component({
    selector:
        'app-catalog-toolbar',

    standalone: true,

    imports: [
        FormsModule,
        IconComponent,
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <div class="toolbar">
      <label class="search-field">
        <app-icon
          name="search"
          [size]="17"
        />

        <input
          type="search"
          [ngModel]="query()"
          (ngModelChange)="
            queryChange.emit($event)
          "
          placeholder="Tìm kiếm truyện, tác giả..."
        />
      </label>

      <label class="sort-field">
        <select
          [ngModel]="sort()"
          (ngModelChange)="
            sortChange.emit($event)
          "
        >
          <option value="latest">
            Mới cập nhật
          </option>

          <option value="popular">
            Xem nhiều nhất
          </option>

          <option value="rating">
            Đánh giá cao
          </option>

          <option value="chapter-count">
            Nhiều chương nhất
          </option>

          <option value="oldest">
            Cập nhật cũ nhất
          </option>
        </select>

        <app-icon
          name="chevron-down"
          [size]="15"
        />
      </label>

      <div
        class="view-switch"
        role="group"
        aria-label="Kiểu hiển thị"
      >
        <button
          type="button"
          aria-label="Hiển thị dạng lưới"
          [class.active]="
            viewMode() === 'grid'
          "
          (click)="
            viewModeChange.emit(
              'grid'
            )
          "
        >
          <app-icon
            name="grid"
            [size]="18"
          />
        </button>

        <button
          type="button"
          aria-label="Hiển thị dạng danh sách"
          [class.active]="
            viewMode() === 'list'
          "
          (click)="
            viewModeChange.emit(
              'list'
            )
          "
        >
          <app-icon
            name="menu"
            [size]="18"
          />
        </button>
      </div>
    </div>
  `,

    styles: `
    .toolbar {
      display: grid;
      grid-template-columns:
        minmax(240px, 1fr)
        178px
        auto;
      gap: 11px;
      align-items: center;
    }

    .search-field,
    .sort-field {
      min-height: 43px;
      display: flex;
      align-items: center;
      border: 1px solid
        rgba(132, 145, 177, .18);
      border-radius: 8px;
      color: #737d92;
      background:
        rgba(5, 10, 21, .46);
    }

    .search-field {
      padding: 0 13px;
      gap: 9px;
    }

    .search-field input {
      min-width: 0;
      flex: 1;
      border: 0;
      outline: 0;
      color: #dedbe4;
      font-size: .95rem;
      background: transparent;
    }

    .search-field input::placeholder {
      color: #667084;
    }

    .sort-field {
      position: relative;
    }

    .sort-field select {
      width: 100%;
      min-height: 41px;
      padding: 0 36px 0 13px;
      appearance: none;
      border: 0;
      outline: 0;
      color: #c2c7d2;
      font-size: .95rem;
      cursor: pointer;
      background: transparent;
    }

    .sort-field app-icon {
      position: absolute;
      right: 11px;
      pointer-events: none;
    }

    .sort-field option {
      color: #e7e4ec;
      background: #101728;
    }

    .view-switch {
      height: 43px;
      padding: 4px;
      display: flex;
      border: 1px solid
        rgba(132, 145, 177, .16);
      border-radius: 8px;
      background:
        rgba(5, 10, 21, .45);
    }

    .view-switch button {
      width: 36px;
      border: 0;
      border-radius: 6px;
      color: #697388;
      cursor: pointer;
      background: transparent;
    }

    .view-switch button.active {
      color: #c181ff;
      background:
        rgba(125, 61, 204, .17);
    }

    @media (max-width: 680px) {
      .toolbar {
        grid-template-columns: 1fr;
      }

      .view-switch {
        width: max-content;
      }
    }
  `,
})
export class CatalogToolbarComponent {
    readonly query = input('');
    readonly sort =
        input<StoryCatalogSort>('latest');

    readonly viewMode =
        input<StoryCatalogViewMode>(
            'grid',
        );

    readonly queryChange =
        output<string>();

    readonly sortChange =
        output<StoryCatalogSort>();

    readonly viewModeChange =
        output<StoryCatalogViewMode>();
}