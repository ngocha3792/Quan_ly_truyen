import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-security-feature-shell',

  standalone: true,

  imports: [RouterLink, IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <header class="page-header">
      <div>
        <a class="back-link" routerLink="/tai-khoan/bao-mat">
          <app-icon name="chevron-left" [size]="16" />

          Bảo mật tài khoản
        </a>

        <h1>{{ title() }}</h1>

        <p>{{ description() }}</p>
      </div>
    </header>

    <div class="feature-layout">
      <main class="feature-main">
        <ng-content select="[security-main]" />
      </main>

      <aside class="feature-aside">
        <ng-content select="[security-aside]" />
      </aside>
    </div>
  `,

  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .page-header {
      margin: 3px 0 20px;
    }

    .back-link {
      width: max-content;
      margin-bottom: 10px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #9d70e9;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
    }

    .back-link:hover {
      color: #c084fc;
    }

    h1 {
      margin: 0;
      color: #f7f5fb;
      font-size: clamp(24px, 2.3vw, 30px);
    }

    p {
      margin: 8px 0 0;
      color: #818ba0;
      font-size: 12px;
      line-height: 1.6;
    }

    .feature-layout {
      display: grid;
      grid-template-columns:
        minmax(0, 1fr)
        245px;
      gap: 18px;
      align-items: start;
    }

    .feature-main,
    .feature-aside {
      min-width: 0;
      display: grid;
      gap: 14px;
    }

    @media (max-width: 1120px) {
      .feature-layout {
        grid-template-columns: 1fr;
      }

      .feature-aside {
        grid-row: 1;
      }
    }
  `,
})
export class SecurityFeatureShellComponent {
  readonly title = input.required<string>();

  readonly description = input.required<string>();
}
