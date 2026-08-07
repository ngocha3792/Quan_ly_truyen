import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

@Component({
    selector: 'app-loading-state',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <section class="loading-state">
      <span class="spinner"></span>
      @if (message()) {
        <p>{{ message() }}</p>
      }
    </section>
  `,
    styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .loading-state {
      min-height: var(--loading-min-height, 430px);
      display: grid;
      place-items: center;
      align-content: center;
      gap: 1.25rem;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: rgba(14, 21, 38, 0.86);
    }

    p {
      margin: 0;
      color: #788297;
      font-size: .875rem;
    }

    .spinner {
      width: 31px;
      height: 31px;
      border: 3px solid rgba(167, 139, 250, 0.2);
      border-top-color: #a78bfa;
      border-radius: 50%;
      animation: spin 700ms linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class LoadingStateComponent {
    readonly message = input<string | null>(null);
}
