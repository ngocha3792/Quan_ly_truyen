import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import {
    IconComponent,
    IconName,
} from '../../../../../shared/components/icon/icon.component';

@Component({
    selector: 'app-session-stat-card',

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
          [size]="23"
        />
      </div>

      <div class="stat-copy">
        <span>{{ label() }}</span>

        <strong>{{ value() }}</strong>

        <small>{{ description() }}</small>
      </div>
    </article>
  `,

    styles: `
    :host {
      min-width: 0;
      display: block;
    }

    .stat-card {
      min-height: 94px;
      padding: 17px;
      display: flex;
      align-items: center;
      gap: 14px;
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
      width: 48px;
      height: 48px;
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      border-radius: 10px;
      color: #bb7df8;
      background:
        rgba(121, 58, 195, .2);
    }

    .stat-card[data-tone='green']
    .stat-icon {
      color: #56dc76;
      background:
        rgba(34, 197, 94, .15);
    }

    .stat-card[data-tone='blue']
    .stat-icon {
      color: #4bbcff;
      background:
        rgba(37, 99, 235, .16);
    }

    .stat-copy {
      min-width: 0;
      display: grid;
      gap: 4px;
    }

    .stat-copy > span {
      color: #94a3b8;
      font-size: 12px;
      font-weight: 600;
    }

    strong {
      overflow: hidden;
      color: #f8fafc;
      font-size: 18px;
      font-weight: 700;
      line-height: 1.15;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      overflow: hidden;
      color: #94a3b8;
      font-size: 11.5px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class SessionStatCardComponent {
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
            'purple' | 'green' | 'blue'
        >('purple');
}