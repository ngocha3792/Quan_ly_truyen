import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-search-field',

  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <label class="search-field">
      <app-icon name="search" [size]="iconSize()" />

      <input
        type="search"
        [value]="value()"
        [placeholder]="placeholder()"
        [disabled]="disabled()"
        [attr.aria-label]="ariaLabel() || null"
        (input)="handleInput($event)"
      />
    </label>
  `,

  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .search-field {
      width: 100%;

      min-height: var(--search-min-height, 43px);

      display: flex;
      align-items: center;

      gap: var(--search-gap, 9px);

      padding: var(--search-padding, 0 13px);

      border: var(--search-border, 1px solid rgba(132, 145, 177, 0.18));

      border-radius: var(--search-radius, 8px);

      color: var(--search-icon-color, #737d92);

      background: var(--search-background, rgba(5, 10, 21, 0.46));

      transition:
        border-color 160ms ease,
        background 160ms ease,
        box-shadow 160ms ease;
    }

    .search-field:focus-within {
      border-color: var(--search-focus-border-color, rgba(168, 85, 247, 0.42));

      box-shadow: var(--search-focus-shadow, 0 0 0 3px rgba(126, 34, 206, 0.09));
    }

    app-icon {
      flex: 0 0 auto;
    }

    input {
      min-width: 0;
      width: 100%;

      height: var(--search-input-height, 40px);

      flex: 1;

      border: 0;
      outline: 0;

      color: var(--search-color, #dedbe4);

      font: inherit;

      font-size: var(--search-font-size, 0.95rem);

      font-weight: var(--search-font-weight, 400);

      background: transparent;
    }

    input::placeholder {
      color: var(--search-placeholder-color, #737d92);
    }

    input:disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }
  `,
})
export class SearchFieldComponent {
  readonly value = input('');

  readonly placeholder = input('Tìm kiếm...');

  readonly ariaLabel = input('');

  readonly disabled = input(false);

  readonly iconSize = input(17);

  readonly valueChange = output<string>();

  protected handleInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;

    this.valueChange.emit(inputElement.value);
  }
}
