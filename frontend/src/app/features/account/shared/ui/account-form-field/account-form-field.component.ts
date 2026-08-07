import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';

import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { IconComponent, IconName } from '../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-account-form-field',

  standalone: true,

  imports: [IconComponent],

  providers: [
    {
      provide: NG_VALUE_ACCESSOR,

      useExisting: forwardRef(() => AccountFormFieldComponent),

      multi: true,
    },
  ],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <label class="field-shell">
      <span class="label">
        {{ label() }}
      </span>

      <span class="input-shell" [class.invalid]="!!error()">
        @if (icon(); as iconName) {
          <app-icon [name]="iconName" [size]="17" />
        }

        <input
          [id]="inputId()"
          [type]="type()"
          [value]="value()"
          [placeholder]="placeholder()"
          [attr.autocomplete]="autocomplete() || null"
          [attr.maxlength]="maxLength() ?? null"
          [disabled]="disabled()"
          (input)="handleInput($event)"
          (blur)="handleBlur()"
        />
      </span>

      @if (error()) {
        <small class="error">
          {{ error() }}
        </small>
      } @else if (hint()) {
        <small class="hint">
          {{ hint() }}
        </small>
      }
    </label>
  `,

  styles: `
    :host {
      display: block;
      min-width: 0;

      text-align: left;
    }

    .field-shell {
      display: grid;

      gap: 7px;
    }

    .label {
      color: var(--account-field-label-color, #94a3b8);

      font-size: var(--account-field-label-size, 13px);

      font-weight: 600;
    }

    .input-shell {
      min-height: var(--account-field-height, 44px);

      padding: var(--account-field-padding, 0 13px);

      display: flex;

      align-items: center;

      gap: 10px;

      border: 1px solid rgba(139, 151, 181, 0.24);

      border-radius: 8px;

      color: #94a3b8;

      background: rgba(5, 10, 21, 0.52);

      transition:
        border-color 160ms ease,
        box-shadow 160ms ease;
    }

    .input-shell:focus-within {
      border-color: rgba(155, 91, 237, 0.72);

      box-shadow: 0 0 0 3px rgba(126, 65, 218, 0.1);
    }

    .input-shell.invalid {
      border-color: rgba(251, 113, 133, 0.6);
    }

    input {
      min-width: 0;

      width: 100%;

      height: calc(var(--account-field-height, 44px) - 2px);

      flex: 1;

      border: 0;
      outline: 0;

      color: #f8fafc;

      font: inherit;

      font-size: 14px;

      background: transparent;
    }

    input::placeholder {
      color: #667084;
    }

    input:disabled {
      cursor: not-allowed;

      opacity: 0.6;
    }

    .error,
    .hint {
      font-size: 12px;

      line-height: 1.5;
    }

    .error {
      color: #fda4b5;
    }

    .hint {
      color: #7f899d;
    }
  `,
})
export class AccountFormFieldComponent implements ControlValueAccessor {
  readonly label = input.required<string>();

  readonly inputId = input('');

  readonly type = input<'text' | 'email'>('text');

  readonly placeholder = input('');

  readonly autocomplete = input('');

  readonly maxLength = input<number | null>(null);

  readonly icon = input<IconName | null>(null);

  readonly error = input('');

  readonly hint = input('');

  readonly valueChange = output<string>();

  protected readonly value = signal('');

  protected readonly disabled = signal(false);

  private onChange: (value: string) => void = () => {};

  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected handleInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    this.value.set(value);

    this.onChange(value);

    this.valueChange.emit(value);
  }

  protected handleBlur(): void {
    this.onTouched();
  }
}
