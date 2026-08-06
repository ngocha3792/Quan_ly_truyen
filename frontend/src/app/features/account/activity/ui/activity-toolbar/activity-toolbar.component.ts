import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';

import { FormsModule } from '@angular/forms';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

import { ActivityCategory } from '../../domain/account-activity.models';

interface ActivityTab {
    readonly id: ActivityCategory;
    readonly label: string;
}

@Component({
    selector:
        'app-activity-toolbar',

    standalone: true,

    imports: [
        FormsModule,
        IconComponent,
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <div class="toolbar-header">
      <h2>Nhật ký hoạt động</h2>

      <div class="toolbar-controls">
        <label class="search-field">
          <app-icon
            name="search"
            [size]="16"
          />

          <input
            type="search"
            [ngModel]="query()"
            (ngModelChange)="
              queryChange.emit($event)
            "
            placeholder="Tìm hoạt động..."
          />
        </label>

        <label class="period-field">
          <app-icon
            name="calendar"
            [size]="15"
          />

          <select
            [ngModel]="periodDays()"
            (ngModelChange)="
              onPeriodChange($event)
            "
          >
            <option [ngValue]="7">
              7 ngày qua
            </option>

            <option [ngValue]="30">
              30 ngày qua
            </option>

            <option [ngValue]="90">
              90 ngày qua
            </option>
          </select>

          <app-icon
            name="chevron-down"
            [size]="14"
          />
        </label>
      </div>
    </div>

    <div
      class="category-tabs"
      role="tablist"
      aria-label="Loại hoạt động"
    >
      @for (
        tab of tabs;
        track tab.id
      ) {
        <button
          type="button"
          role="tab"
          [class.active]="
            category() === tab.id
          "
          [attr.aria-selected]="
            category() === tab.id
          "
          (click)="
            categoryChange.emit(
              tab.id
            )
          "
        >
          {{ tab.label }}
        </button>
      }
    </div>
  `,

    styles: `
    .toolbar-header {
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
    }

    h2 {
      margin: 0;
      color: #f8fafc;
      font-size: 15px;
      font-weight: 700;
    }

    .toolbar-controls {
      display: flex;
      align-items: center;
      gap: 9px;
    }

    .search-field,
    .period-field {
      min-height: 42px;
      display: flex;
      align-items: center;
      border: 1px solid
        rgba(139, 151, 181, .2);
      border-radius: 7px;
      color: #94a3b8;
      background:
        rgba(5, 10, 21, .5);
    }

    .search-field {
      width: 230px;
      padding: 0 12px;
      gap: 8px;
    }

    .search-field input {
      min-width: 0;
      flex: 1;
      border: 0;
      outline: 0;
      color: #f8fafc;
      font-size: 13.5px;
      background: transparent;
    }

    .period-field {
      position: relative;
      min-width: 130px;
      padding-left: 10px;
      gap: 4px;
    }

    .period-field select {
      min-height: 40px;
      flex: 1;
      appearance: none;
      border: 0;
      outline: 0;
      color: #f8fafc;
      font-size: 13.5px;
      cursor: pointer;
      background: transparent;
    }

    .period-field > app-icon:last-child {
      margin-right: 8px;
      pointer-events: none;
    }

    .period-field option {
      color: #f8fafc;
      background: #101728;
    }

    .category-tabs {
      padding: 0 16px 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      border-bottom:
        1px solid var(--border);
    }

    .category-tabs button {
      min-height: 36px;
      padding: 0 16px;
      border: 1px solid
        rgba(139, 151, 181, .14);
      border-radius: 6px;
      color: #cbd5e1;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      background: transparent;
    }

    .category-tabs button:hover {
      color: #d8d5df;
      border-color:
        rgba(157, 94, 240, .3);
    }

    .category-tabs button.active {
      border-color: transparent;
      color: #fff;
      background:
        linear-gradient(
          135deg,
          #743bde,
          #a153eb
        );
    }

    @media (max-width: 760px) {
      .toolbar-header {
        align-items: stretch;
        flex-direction: column;
      }

      .toolbar-controls {
        flex-wrap: wrap;
      }

      .search-field {
        flex: 1;
      }
    }

    @media (max-width: 520px) {
      .search-field,
      .period-field {
        width: 100%;
      }
    }
  `,
})
export class ActivityToolbarComponent {
    readonly query = input('');

    readonly category =
        input<ActivityCategory>('all');

    readonly periodDays =
        input<7 | 30 | 90>(7);

    readonly queryChange =
        output<string>();

    readonly categoryChange =
        output<ActivityCategory>();

    readonly periodDaysChange =
        output<7 | 30 | 90>();

    protected onPeriodChange(val: string | number): void {
        const num = Number(val);
        if (num === 7 || num === 30 || num === 90) {
            this.periodDaysChange.emit(num);
        }
    }

    protected readonly tabs:
        readonly ActivityTab[] = [
            {
                id: 'all',
                label: 'Tất cả',
            },
            {
                id: 'login',
                label: 'Đăng nhập',
            },
            {
                id: 'security',
                label: 'Bảo mật',
            },
            {
                id: 'account',
                label: 'Tài khoản',
            },
            {
                id: 'device',
                label: 'Thiết bị',
            },
        ];
}