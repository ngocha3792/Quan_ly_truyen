import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import {
    IconComponent,
    IconName,
} from '../../../../shared/components/icon/icon.component';

export type AccountActionTone =
    | 'purple'
    | 'orange'
    | 'blue'
    | 'green';

@Component({
    selector: 'app-account-action-card',
    standalone: true,
    imports: [
        RouterLink,
        IconComponent,
    ],
    changeDetection:
        ChangeDetectionStrategy.OnPush,
    template: `
    <a
      class="action-card"
      [attr.data-tone]="tone()"
      [routerLink]="route()"
    >
      <div class="action-icon">
        <app-icon
          [name]="icon()"
          [size]="25"
        />
      </div>

      <div class="action-content">
        <h3>{{ title() }}</h3>

        <p>{{ description() }}</p>

        <span class="action-link">
          {{ linkLabel() }}

          <app-icon
            name="arrow-right"
            [size]="15"
          />
        </span>
      </div>
    </a>
  `,
    styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .action-card {
      min-height: 152px;
      padding: 25px 22px;
      display: flex;
      align-items: flex-start;
      gap: 17px;
      border: 1px solid var(--border);
      border-radius: 14px;
      color: inherit;
      text-decoration: none;
      background:
        linear-gradient(
          145deg,
          rgba(16, 24, 42, .98),
          rgba(10, 16, 31, .98)
        );
      box-shadow:
        0 16px 40px rgba(0, 0, 0, .1);
      transition:
        transform 180ms ease,
        border-color 180ms ease,
        box-shadow 180ms ease;
    }

    .action-card:hover {
      transform: translateY(-3px);
      border-color:
        rgba(151, 102, 236, .35);
      box-shadow:
        0 20px 45px rgba(0, 0, 0, .18);
    }

    .action-icon {
      width: 52px;
      height: 52px;
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: #a970f8;
      background:
        rgba(125, 62, 219, .2);
      box-shadow:
        0 7px 24px
        rgba(92, 38, 175, .16);
    }

    .action-card[data-tone='orange']
    .action-icon {
      color: #ffad2f;
      background:
        rgba(197, 111, 16, .2);
    }

    .action-card[data-tone='blue']
    .action-icon {
      color: #43c0ff;
      background:
        rgba(22, 124, 194, .2);
    }

    .action-card[data-tone='green']
    .action-icon {
      color: #55dc68;
      background:
        rgba(39, 159, 65, .2);
    }

    .action-content {
      min-width: 0;
    }

    h3 {
      margin: 1px 0 8px;
      color: #f1eff6;
      font-size: 13px;
    }

    p {
      min-height: 38px;
      margin: 0;
      color: #7f899f;
      font-size: 10px;
      line-height: 1.65;
    }

    .action-link {
      margin-top: 14px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #ad77f8;
      font-size: 10px;
      font-weight: 780;
    }

    @media (max-width: 520px) {
      .action-card {
        padding: 21px 18px;
      }
    }
  `,
})
export class AccountActionCardComponent {
    readonly title =
        input.required<string>();

    readonly description =
        input.required<string>();

    readonly linkLabel =
        input.required<string>();

    readonly route =
        input.required<string>();

    readonly icon =
        input.required<IconName>();

    readonly tone =
        input<AccountActionTone>('purple');
}