import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { FormsModule } from '@angular/forms';

import { IconComponent } from '../../../../../../shared/components/icon/icon.component';

import { SearchFieldComponent } from '../../../../../../shared/components/search-field/search-field.component';

import {
  TabFilterComponent,
  TabFilterOption,
} from '../../../../../../shared/components/tab-filter/tab-filter.component';

import { ActivityCategory } from '../../domain/account-activity.models';

@Component({
  selector: 'app-activity-toolbar',

  standalone: true,

  imports: [FormsModule, IconComponent, SearchFieldComponent, TabFilterComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <div class="toolbar-header">
      <h2>Nhật ký hoạt động</h2>

      <div class="toolbar-controls">
        <app-search-field
          class="activity-search"
          [value]="query()"
          placeholder="Tìm hoạt động..."
          ariaLabel="Tìm hoạt động"
          [iconSize]="16"
          (valueChange)="queryChange.emit($event)"
        />

        <label class="period-field">
          <app-icon name="calendar" [size]="15" />

          <select [ngModel]="periodDays()" (ngModelChange)="onPeriodChange($event)">
            <option [ngValue]="7">7 ngày qua</option>

            <option [ngValue]="30">30 ngày qua</option>

            <option [ngValue]="90">90 ngày qua</option>
          </select>

          <app-icon name="chevron-down" [size]="14" />
        </label>
      </div>
    </div>

    <app-tab-filter
      class="category-tabs"
      ariaLabel="Loại hoạt động"
      [options]="tabOptions"
      [selected]="category()"
      (selectedChange)="categoryChange.emit($event)"
    />
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

    .activity-search {
      width: 230px;

      --search-min-height: 42px;

      --search-input-height: 40px;

      --search-radius: 7px;

      --search-border: 1px solid rgba(139, 151, 181, 0.2);

      --search-background: rgba(5, 10, 21, 0.5);

      --search-padding: 0 12px;

      --search-gap: 8px;

      --search-color: #f8fafc;

      --search-font-size: 13.5px;

      --search-icon-color: #94a3b8;

      --search-placeholder-color: #94a3b8;
    }

    .period-field {
      position: relative;

      min-width: 130px;

      min-height: 42px;

      padding-left: 10px;

      display: flex;

      align-items: center;

      gap: 4px;

      border: 1px solid rgba(139, 151, 181, 0.2);

      border-radius: 7px;

      color: #94a3b8;

      background: rgba(5, 10, 21, 0.5);
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

      border-bottom: 1px solid var(--border);

      --tab-padding: 0 16px;

      --tab-min-height: 36px;

      --tab-radius: 6px;

      --tab-font-size: 13px;

      --tab-font-weight: 600;

      --tab-border: 1px solid rgba(139, 151, 181, 0.14);

      --tab-color: #cbd5e1;

      --tab-hover-color: #d8d5df;

      --tab-active-color: #fff;

      --tab-active-border-color: transparent;

      --tab-active-background: linear-gradient(135deg, #743bde, #a153eb);
    }

    @media (max-width: 760px) {
      .toolbar-header {
        align-items: stretch;

        flex-direction: column;
      }

      .toolbar-controls {
        flex-wrap: wrap;
      }

      .activity-search {
        flex: 1;
      }
    }

    @media (max-width: 520px) {
      .activity-search,
      .period-field {
        width: 100%;
      }
    }
  `,
})
export class ActivityToolbarComponent {
  readonly query = input('');

  readonly category = input<ActivityCategory>('all');

  readonly periodDays = input<7 | 30 | 90>(7);

  readonly queryChange = output<string>();

  readonly categoryChange = output<ActivityCategory>();

  readonly periodDaysChange = output<7 | 30 | 90>();

  protected onPeriodChange(value: string | number): void {
    const period = Number(value);

    if (period === 7 || period === 30 || period === 90) {
      this.periodDaysChange.emit(period);
    }
  }

  protected readonly tabOptions: readonly TabFilterOption<ActivityCategory>[] = [
    {
      value: 'all',
      label: 'Tất cả',
    },
    {
      value: 'login',
      label: 'Đăng nhập',
    },
    {
      value: 'security',
      label: 'Bảo mật',
    },
    {
      value: 'account',
      label: 'Tài khoản',
    },
    {
      value: 'device',
      label: 'Thiết bị',
    },
  ];
}
