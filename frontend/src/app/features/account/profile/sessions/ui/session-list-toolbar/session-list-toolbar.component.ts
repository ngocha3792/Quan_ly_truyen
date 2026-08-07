import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { FormsModule } from '@angular/forms';

import { IconComponent } from '../../../../../../shared/components/icon/icon.component';

import { SearchFieldComponent } from '../../../../../../shared/components/search-field/search-field.component';

import { SessionFilter } from '../../domain/account-session.models';

@Component({
  selector: 'app-session-list-toolbar',

  standalone: true,

  imports: [FormsModule, IconComponent, SearchFieldComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <div class="toolbar">
      <h2>Các phiên đăng nhập khác</h2>

      <div class="toolbar-controls">
        <app-search-field
          class="session-search"
          [value]="query()"
          placeholder="Tìm thiết bị hoặc IP..."
          ariaLabel="Tìm thiết bị hoặc địa chỉ IP"
          [iconSize]="16"
          (valueChange)="queryChange.emit($event)"
        />

        <label class="filter-field">
          <select [ngModel]="filter()" (ngModelChange)="filterChange.emit($event)">
            <option value="all">Tất cả trạng thái</option>

            <option value="active">Đang hoạt động</option>

            <option value="expired">Đã hết hạn</option>

            <option value="trusted">Thiết bị tin cậy</option>
          </select>

          <app-icon name="chevron-down" [size]="15" />
        </label>

        <button
          class="revoke-all-button"
          type="button"
          [disabled]="busy() || revocableCount() === 0"
          (click)="revokeAllRequested.emit()"
        >
          <app-icon name="logout" [size]="17" />

          Thu hồi tất cả phiên khác
        </button>
      </div>
    </div>
  `,

  styles: `
    .toolbar {
      padding: 15px 16px;

      display: flex;

      align-items: center;

      justify-content: space-between;

      gap: 17px;

      border-bottom: 1px solid var(--border);
    }

    h2 {
      margin: 0;

      color: #f8fafc;

      font-size: 15px;

      font-weight: 700;

      white-space: nowrap;
    }

    .toolbar-controls {
      min-width: 0;

      display: flex;

      align-items: center;

      justify-content: flex-end;

      gap: 10px;
    }

    .session-search {
      width: 250px;

      --search-min-height: 42px;

      --search-input-height: 40px;

      --search-radius: 7px;

      --search-border: 1px solid rgba(139, 151, 181, 0.2);

      --search-background: rgba(5, 10, 21, 0.48);

      --search-padding: 0 12px;

      --search-gap: 8px;

      --search-color: #f8fafc;

      --search-font-size: 13.5px;

      --search-icon-color: #94a3b8;

      --search-placeholder-color: #94a3b8;
    }

    .filter-field {
      position: relative;

      min-width: 178px;

      min-height: 42px;

      display: flex;

      align-items: center;

      border: 1px solid rgba(139, 151, 181, 0.2);

      border-radius: 7px;

      color: #94a3b8;

      background: rgba(5, 10, 21, 0.48);
    }

    .filter-field select {
      width: 100%;

      min-height: 40px;

      padding: 0 34px 0 12px;

      appearance: none;

      border: 0;

      outline: 0;

      color: #f8fafc;

      font-size: 13.5px;

      cursor: pointer;

      background: transparent;
    }

    .filter-field app-icon {
      position: absolute;

      right: 10px;

      pointer-events: none;
    }

    .filter-field option {
      color: #f8fafc;

      background: #101728;
    }

    .revoke-all-button {
      min-height: 42px;

      padding: 0 16px;

      display: inline-flex;

      align-items: center;

      gap: 7px;

      border: 0;

      border-radius: 7px;

      color: #fff;

      font-size: 13px;

      font-weight: 650;

      cursor: pointer;

      background: linear-gradient(135deg, #743bde, #a153eb);
    }

    .revoke-all-button:disabled {
      opacity: 0.45;

      cursor: not-allowed;
    }

    @media (max-width: 1050px) {
      .toolbar {
        align-items: stretch;

        flex-direction: column;
      }

      .toolbar-controls {
        justify-content: flex-start;

        flex-wrap: wrap;
      }
    }

    @media (max-width: 600px) {
      .session-search,
      .filter-field,
      .revoke-all-button {
        width: 100%;
      }
    }
  `,
})
export class SessionListToolbarComponent {
  readonly query = input('');

  readonly filter = input<SessionFilter>('all');

  readonly busy = input(false);

  readonly revocableCount = input(0);

  readonly queryChange = output<string>();

  readonly filterChange = output<SessionFilter>();

  readonly revokeAllRequested = output<void>();
}
