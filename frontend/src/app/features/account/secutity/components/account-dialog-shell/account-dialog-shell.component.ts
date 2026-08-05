import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
    selector:
        'app-account-dialog-shell',
    standalone: true,
    imports: [IconComponent],
    changeDetection:
        ChangeDetectionStrategy.OnPush,
    template: `
    @if (open()) {
      <div
        class="dialog-backdrop"
        role="presentation"
        (click)="requestClose()"
      >
        <section
          class="dialog-card"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="
            dialogTitleId()
          "
          (click)="$event.stopPropagation()"
        >
          <header class="dialog-header">
            <div>
              <p>{{ eyebrow() }}</p>

              <h2 [id]="dialogTitleId()">
                {{ title() }}
              </h2>
            </div>

            <button
              type="button"
              aria-label="Đóng"
              [disabled]="busy()"
              (click)="requestClose()"
            >
              <app-icon
                name="close"
                [size]="19"
              />
            </button>
          </header>

          <div class="dialog-content">
            <ng-content />
          </div>
        </section>
      </div>
    }
  `,
    styles: `
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      padding: 24px;
      display: grid;
      place-items: center;
      overflow-y: auto;
      background: rgba(1, 5, 14, .78);
      backdrop-filter: blur(8px);
    }

    .dialog-card {
      width: min(100%, 510px);
      overflow: hidden;
      border: 1px solid rgba(143, 155, 185, .2);
      border-radius: 17px;
      background:
        linear-gradient(
          145deg,
          #11192b,
          #090f1e
        );
      box-shadow:
        0 35px 90px rgba(0, 0, 0, .48);
    }

    .dialog-header {
      padding: 22px 23px 18px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
      border-bottom:
        1px solid rgba(143, 155, 185, .13);
    }

    .dialog-header p {
      margin: 0 0 6px;
      color: #a76af4;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .1em;
    }

    .dialog-header h2 {
      margin: 0;
      color: #f6f4fa;
      font-size: 21px;
    }

    .dialog-header button {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(143, 155, 185, .15);
      border-radius: 8px;
      color: #8d96aa;
      cursor: pointer;
      background: rgba(255, 255, 255, .025);
    }

    .dialog-header button:hover {
      color: #fff;
    }

    .dialog-header button:disabled {
      opacity: .45;
      cursor: not-allowed;
    }

    .dialog-content {
      padding: 23px;
    }

    @media (max-width: 520px) {
      .dialog-backdrop {
        padding: 12px;
      }

      .dialog-content,
      .dialog-header {
        padding-inline: 18px;
      }
    }
  `,
})
export class AccountDialogShellComponent {
    readonly open = input(false);
    readonly busy = input(false);

    readonly title =
        input.required<string>();

    readonly eyebrow =
        input('BẢO MẬT TÀI KHOẢN');

    readonly dialogTitleId =
        input('account-dialog-title');

    readonly closed = output<void>();

    protected requestClose(): void {
        if (this.busy()) {
            return;
        }

        this.closed.emit();
    }
}