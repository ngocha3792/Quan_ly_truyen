import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-auth-flow-page-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="auth-flow-page">
      <div class="auth-flow-container">
        <ng-content />
      </div>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100%;
    }

    .auth-flow-page {
      min-height: calc(100vh - 72px);
      display: grid;
      place-items: center;
      padding: 3rem 1rem 5rem;
      color: var(--text-strong);

      background:
        radial-gradient(circle at 10% 5%, rgba(103, 44, 204, 0.08), transparent 480px), #060b16;
    }

    .auth-flow-container {
      width: min(100%, 760px);
      margin: 0 auto;
    }

    @media (max-width: 600px) {
      .auth-flow-page {
        padding: 2rem 0.75rem 3.5rem;
      }
    }
  `,
})
export class AuthFlowPageShellComponent {}
