import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';

import { FormsModule } from '@angular/forms';

import { IconComponent } from '../icon/icon.component';

export interface SortOption<T = string> {
    readonly value: T;
    readonly label: string;
}

@Component({
    selector: 'app-sort-select',
    standalone: true,
    imports: [FormsModule, IconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <label class="sort-field">
      <select
        [ngModel]="value()"
        (ngModelChange)="valueChange.emit($event)"
      >
        @for (option of options(); track option.value) {
          <option [value]="option.value">
            {{ option.label }}
          </option>
        }
      </select>

      <app-icon name="chevron-down" [size]="15" />
    </label>
  `,
    styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .sort-field {
      position: relative;
      min-height: 43px;
      display: flex;
      align-items: center;
      border: 1px solid rgba(132, 145, 177, .18);
      border-radius: 8px;
      color: #737d92;
      background: rgba(5, 10, 21, .46);
    }

    select {
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

    select option {
      color: #e7e4ec;
      background: #101728;
    }

    app-icon {
      position: absolute;
      right: 11px;
      pointer-events: none;
    }
  `,
})
export class SortSelectComponent<T = string> {
    readonly options =
        input.required<readonly SortOption<T>[]>();

    readonly value = input.required<T>();

    readonly valueChange = output<T>();
}
