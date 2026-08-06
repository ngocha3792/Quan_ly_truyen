import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
    selector:
        'app-confirm-session-dialog',

    standalone: true,

    imports: [IconComponent],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    @if (open()) {
      <div
        class="backdrop"
        role="presentation"
        (click)="cancel()"
      >
        <section
          class="dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-dialog-title"
          (click)="$event.stopPropagation()"
        >
          <div class="warning-icon">
            <app-icon
              name="alert-triangle"
              [size]="25"
            />
          </div>

          <h2 id="session-dialog-title">
            {{ title() }}
          </h2>

          <p>{{ message() }}</p>

          <div class="actions">
            <button
              class="cancel-button"
              type="button"
              [disabled]="busy()"
              (click)="cancel()"
            >
              Hủy
            </button>

            <button
              class="confirm-button"
              type="button"
              [disabled]="busy()"
              (click)="confirmed.emit()"
            >
              @if (busy()) {
                <span class="spinner"></span>
              } @else {
                <app-icon
                  name="logout"
                  [size]="15"
                />
              }

              {{ confirmLabel() }}
            </button>
          </div>
        </section>
      </div>
    }
  `,

    styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      padding: 20px;
      display: grid;
      place-items: center;
      background:
        rgba(1, 5, 14, .78);
      backdrop-filter: blur(8px);
    }

    .dialog {
      width: min(100%, 430px);
      padding: 28px;
      text-align: center;
      border: 1px solid
        rgba(143, 155, 185, .2);
      border-radius: 16px;
      background:
        linear-gradient(
          145deg,
          #11192b,
          #090f1e
        );
      box-shadow:
        0 35px 90px
        rgba(0, 0, 0, .48);
    }

    .warning-icon {
      width: 58px;
      height: 58px;
      margin: 0 auto 17px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: #fb7185;
      background:
        rgba(190, 24, 93, .12);
    }

    h2 {
      margin: 0;
      color: #f8fafc;
      font-size: 20px;
      font-weight: 700;
    }

    p {
      margin: 13px 0 0;
      color: #94a3b8;
      font-size: 13px;
      line-height: 1.65;
    }

    .actions {
      margin-top: 23px;
      display: flex;
      justify-content: center;
      gap: 9px;
    }

    button {
      min-height: 42px;
      padding: 0 18px;
      border-radius: 7px;
      font-size: 13.5px;
      font-weight: 650;
      cursor: pointer;
    }

    button:disabled {
      opacity: .48;
      cursor: not-allowed;
    }

    .cancel-button {
      border: 1px solid
        rgba(139, 151, 181, .25);
      color: #babfcb;
      background: transparent;
    }

    .confirm-button {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      border: 1px solid
        rgba(244, 63, 94, .7);
      color: #fb7185;
      background:
        rgba(190, 24, 93, .08);
    }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid
        rgba(251, 113, 133, .25);
      border-top-color: #fb7185;
      border-radius: 50%;
      animation:
        dialog-spinner
        650ms
        linear
        infinite;
    }

    @keyframes dialog-spinner {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class ConfirmSessionDialogComponent {
    readonly open = input(false);
    readonly busy = input(false);

    readonly title =
        input.required<string>();

    readonly message =
        input.required<string>();

    readonly confirmLabel =
        input('Thu hồi phiên');

    readonly confirmed = output<void>();
    readonly cancelled = output<void>();

    protected cancel(): void {
        if (this.busy()) {
            return;
        }

        this.cancelled.emit();
    }
}