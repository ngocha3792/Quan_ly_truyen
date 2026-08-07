import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';

export interface TabFilterOption<T = string> {
    readonly value: T;
    readonly label: string;
}

@Component({
    selector: 'app-tab-filter',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div
      class="tab-filter"
      role="tablist"
      [attr.aria-label]="ariaLabel()"
    >
      @for (option of options(); track option.value) {
        <button
          type="button"
          role="tab"
          [class.active]="selected() === option.value"
          [attr.aria-selected]="selected() === option.value"
          (click)="selectedChange.emit(option.value)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
    styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .tab-filter {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 7px;
    }

    button {
      min-height: 31px;
      padding: 0 13px;
      flex: 0 0 auto;
      border: 1px solid rgba(132, 145, 177, .15);
      border-radius: 7px;
      color: #969fb0;
      font-size: .85rem;
      font-weight: 620;
      cursor: pointer;
      background: rgba(12, 18, 33, .72);
      transition:
        color 160ms ease,
        border-color 160ms ease,
        background 160ms ease;
    }

    button:hover {
      color: #e8e5ed;
      border-color: rgba(155, 92, 238, .3);
    }

    button.active {
      border-color: transparent;
      color: #fff;
      background: linear-gradient(
        135deg,
        #743bde,
        #a153eb
      );
      box-shadow: 0 7px 18px rgba(114, 55, 216, .22);
    }

    @media (max-width: 470px) {
      .tab-filter {
        gap: 5px;
      }

      button {
        min-height: 28px;
        padding: 0 10px;
        font-size: .8rem;
      }
    }
  `,
})
export class TabFilterComponent<T = string> {
    readonly options =
        input.required<readonly TabFilterOption<T>[]>();

    readonly selected = input.required<T>();

    readonly ariaLabel = input('Bộ lọc');

    readonly selectedChange = output<T>();
}
