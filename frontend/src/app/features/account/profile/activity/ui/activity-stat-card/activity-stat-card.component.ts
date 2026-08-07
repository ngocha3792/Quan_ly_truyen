import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import {
    IconComponent,
    IconName,
} from '../../../../../../shared/components/icon/icon.component';

@Component({
    selector:
        'app-activity-stat-card',

    standalone: true,

    imports: [IconComponent],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <article
      class="stat-card"
      [attr.data-tone]="tone()"
    >
      <div class="stat-icon">
        <app-icon
          [name]="icon()"
          [size]="24"
        />
      </div>

      <div>
        <span>{{ label() }}</span>

        <strong>{{ value() }}</strong>

        <small>{{ description() }}</small>
      </div>
    </article>
  `,

    styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .stat-card {
      min-height: 96px;
      padding: 17px;
      display: flex;
      align-items: center;
      gap: 15px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background:
        linear-gradient(
          145deg,
          rgba(17, 25, 44, .98),
          rgba(10, 16, 31, .98)
        );
    }

    .stat-icon {
      width: 50px;
      height: 50px;
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      border-radius: 11px;
      color: #bd7ffa;
      background:
        rgba(125, 61, 204, .2);
    }

    .stat-card[data-tone='blue']
    .stat-icon {
      color: #62adff;
      background:
        rgba(37, 99, 235, .18);
    }

    .stat-card[data-tone='green']
    .stat-icon {
      color: #5ade7a;
      background:
        rgba(16, 185, 129, .18);
    }

    .stat-card[data-tone='orange']
    .stat-icon {
      color: #f7a23d;
      background:
        rgba(217, 119, 6, .18);
    }

    .stat-card > div:last-child {
      min-width: 0;
      display: grid;
      gap: 3px;
    }

    span {
      color: #94a3b8;
      font-size: 12px;
      font-weight: 600;
    }

    strong {
      color: #f8fafc;
      font-size: 21px;
      font-weight: 700;
      line-height: 1.1;
    }

    small {
      color: #94a3b8;
      font-size: 11.5px;
    }
  `,
})
export class ActivityStatCardComponent {
    readonly label =
        input.required<string>();

    readonly value =
        input.required<
            string | number
        >();

    readonly description =
        input.required<string>();

    readonly icon =
        input.required<IconName>();

    readonly tone =
        input<
            'purple'
            | 'blue'
            | 'green'
            | 'orange'
        >('purple');
}