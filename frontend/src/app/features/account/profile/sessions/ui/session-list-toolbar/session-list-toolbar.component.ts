import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';

import { FormsModule } from '@angular/forms';

import { IconComponent } from '../../../../../../shared/components/icon/icon.component';

import { SessionFilter } from '../../domain/account-session.models';

@Component({
    selector:
        'app-session-list-toolbar',

    standalone: true,

    imports: [
        FormsModule,
        IconComponent,
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <div class="toolbar">
      <h2>Các phiên đăng nhập khác</h2>

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
            placeholder="Tìm thiết bị hoặc IP..."
          />
        </label>

        <label class="filter-field">
          <select
            [ngModel]="filter()"
            (ngModelChange)="
              filterChange.emit($event)
            "
          >
            <option value="all">
              Tất cả trạng thái
            </option>

            <option value="active">
              Đang hoạt động
            </option>

            <option value="expired">
              Đã hết hạn
            </option>

            <option value="trusted">
              Thiết bị tin cậy
            </option>
          </select>

          <app-icon
            name="chevron-down"
            [size]="15"
          />
        </label>

        <button
          class="revoke-all-button"
          type="button"
          [disabled]="
            busy() ||
            revocableCount() === 0
          "
          (click)="
            revokeAllRequested.emit()
          "
        >
          <app-icon
            name="logout"
            [size]="17"
          />

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

    .search-field,
    .filter-field {
      min-height: 42px;
      display: flex;
      align-items: center;
      border: 1px solid
        rgba(139, 151, 181, .2);
      border-radius: 7px;
      color: #94a3b8;
      background:
        rgba(5, 10, 21, .48);
    }

    .search-field {
      width: 250px;
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

    .filter-field {
      position: relative;
      min-width: 178px;
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
      background:
        linear-gradient(
          135deg,
          #743bde,
          #a153eb
        );
    }

    .revoke-all-button:disabled {
      opacity: .45;
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
      .search-field,
      .filter-field,
      .revoke-all-button {
        width: 100%;
      }
    }
  `,
})
export class SessionListToolbarComponent {
    readonly query = input('');
    readonly filter =
        input<SessionFilter>('all');

    readonly busy = input(false);
    readonly revocableCount = input(0);

    readonly queryChange =
        output<string>();

    readonly filterChange =
        output<SessionFilter>();

    readonly revokeAllRequested =
        output<void>();
}