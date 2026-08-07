import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';

@Component({
    selector: 'app-error-alert',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <section class="error-alert" role="alert">
      <div class="error-body">
        <strong>{{ title() }}</strong>
        @if (message()) {
          <span>{{ message() }}</span>
        }
      </div>

      <button
        type="button"
        (click)="retry.emit()"
      >
        {{ retryLabel() }}
      </button>
    </section>
  `,
    styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .error-alert {
      margin-bottom: 1rem;
      padding: .875rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border: 1px solid rgba(251, 113, 133, 0.24);
      border-radius: 8px;
      color: #fda4b5;
      background: rgba(190, 24, 93, 0.08);
    }

    .error-body {
      display: grid;
      gap: 4px;
    }

    strong {
      font-size: .875rem;
    }

    span {
      color: #a77c86;
      font-size: .75rem;
    }

    button {
      min-height: 34px;
      padding: 0 14px;
      flex: 0 0 auto;
      border: 1px solid rgba(251, 113, 133, 0.3);
      border-radius: 6px;
      color: #fda4b5;
      font-size: .75rem;
      font-weight: 600;
      cursor: pointer;
      background: transparent;
      transition:
        background 160ms ease,
        border-color 160ms ease;
    }

    button:hover {
      background: rgba(190, 24, 93, 0.12);
      border-color: rgba(251, 113, 133, 0.5);
    }

    @media (max-width: 620px) {
      .error-alert {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `,
})
export class ErrorAlertComponent {
    readonly title = input('Đã xảy ra lỗi');
    readonly message = input<string | null>(null);
    readonly retryLabel = input('Thử lại');

    readonly retry = output<void>();
}
