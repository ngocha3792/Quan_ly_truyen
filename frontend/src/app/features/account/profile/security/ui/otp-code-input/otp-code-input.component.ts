import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  QueryList,
  signal,
  ViewChildren,
} from '@angular/core';

@Component({
  selector: 'app-otp-code-input',

  standalone: true,

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <div class="otp-input" (paste)="onPaste($event)">
      @for (index of indexes; track index) {
        <input
          #digitInput
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="1"
          autocomplete="one-time-code"
          [disabled]="disabled()"
          [value]="digits()[index]"
          [attr.aria-label]="'Chữ số OTP ' + (index + 1)"
          (input)="onInput($event, index)"
          (keydown)="onKeydown($event, index)"
        />
      }
    </div>
  `,

  styles: `
    .otp-input {
      display: grid;
      grid-template-columns: repeat(6, 48px);
      gap: 9px;
    }

    input {
      width: 48px;
      height: 52px;
      padding: 0;
      border: 1px solid rgba(139, 151, 181, 0.27);
      border-radius: 9px;
      outline: 0;
      color: #f5f3fa;
      font-size: 21px;
      font-weight: 800;
      text-align: center;
      background: rgba(5, 10, 21, 0.58);
      transition:
        border-color 160ms ease,
        box-shadow 160ms ease;
    }

    input:focus {
      border-color: rgba(157, 92, 239, 0.8);
      box-shadow: 0 0 0 3px rgba(126, 65, 218, 0.11);
    }

    input:disabled {
      opacity: 0.5;
    }

    @media (max-width: 520px) {
      .otp-input {
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 6px;
      }

      input {
        width: 100%;
        height: 46px;
      }
    }
  `,
})
export class OtpCodeInputComponent {
  readonly disabled = input(false);

  readonly valueChange = output<string>();

  protected readonly indexes = [0, 1, 2, 3, 4, 5] as const;

  protected readonly digits = signal<string[]>(['', '', '', '', '', '']);

  @ViewChildren('digitInput')
  private readonly inputs!: QueryList<ElementRef<HTMLInputElement>>;

  protected onInput(event: Event, index: number): void {
    const target = event.target as HTMLInputElement;

    const digit = target.value.replace(/\D/gu, '').slice(-1);

    const next = [...this.digits()];
    next[index] = digit;

    target.value = digit;
    this.digits.set(next);
    this.emitValue();

    if (digit && index < 5) {
      this.focus(index + 1);
    }
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.digits()[index] && index > 0) {
      this.focus(index - 1);
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focus(index - 1);
    }

    if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault();
      this.focus(index + 1);
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text').replace(/\D/gu, '').slice(0, 6) ?? '';

    if (!pasted) {
      return;
    }

    event.preventDefault();

    const next = Array.from({ length: 6 }, (_, index) => pasted[index] ?? '');

    this.digits.set(next);
    this.emitValue();

    this.focus(Math.min(pasted.length, 6) - 1);
  }

  reset(): void {
    this.digits.set(['', '', '', '', '', '']);

    this.emitValue();
    this.focus(0);
  }

  private emitValue(): void {
    this.valueChange.emit(this.digits().join(''));
  }

  private focus(index: number): void {
    this.inputs.get(index)?.nativeElement.focus();
  }
}
