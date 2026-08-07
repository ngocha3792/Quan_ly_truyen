import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';

import {
    IconComponent,
    IconName,
} from '../../../../../../shared/components/icon/icon.component';

export type SecurityCardTone =
    | 'default'
    | 'success'
    | 'danger';

@Component({
    selector:
        'app-security-setting-card',
    standalone: true,
    imports: [IconComponent],
    changeDetection:
        ChangeDetectionStrategy.OnPush,
    template: `
    <article
      class="setting-card"
      [attr.data-tone]="tone()"
    >
      <div class="setting-icon">
        <app-icon
          [name]="icon()"
          [size]="23"
        />
      </div>

      <div class="setting-copy">
        <h3>{{ title() }}</h3>

        <p>{{ description() }}</p>
      </div>

      @if (value()) {
        <span class="setting-value">
          {{ value() }}
        </span>
      }

      @if (badge()) {
        <span
          class="setting-badge"
          [class.enabled]="
            badgeTone() === 'success'
          "
        >
          {{ badge() }}
        </span>
      }

      @if (actionLabel()) {
        <button
          type="button"
          class="setting-action"
          [class.danger]="
            tone() === 'danger'
          "
          (click)="action.emit()"
        >
          {{ actionLabel() }}
        </button>
      } @else {
        <button
          type="button"
          class="chevron-action"
          aria-label="Mở chi tiết"
          (click)="action.emit()"
        >
          <app-icon
            name="chevron-right"
            [size]="20"
          />
        </button>
      }
    </article>
  `,
    styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .setting-card {
      min-height: 94px;
      padding: 18px 20px;
      display: grid;
      grid-template-columns:
        auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 17px;
      border: 1px solid var(--border);
      border-radius: 13px;
      background:
        linear-gradient(
          145deg,
          rgba(17, 25, 44, .98),
          rgba(10, 16, 31, .98)
        );
      box-shadow:
        0 14px 38px rgba(0, 0, 0, .1);
      transition:
        transform 170ms ease,
        border-color 170ms ease;
    }

    .setting-card:hover {
      transform: translateY(-2px);
      border-color:
        rgba(148, 93, 232, .3);
    }

    .setting-icon {
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      color: #bf7fff;
      background:
        rgba(121, 58, 195, .2);
    }

    .setting-copy {
      min-width: 0;
    }

    h3 {
      margin: 0 0 7px;
      color: #f8fafc;
      font-size: 15.5px;
      font-weight: 700;
    }

    p {
      margin: 0;
      color: #94a3b8;
      font-size: 12.5px;
      line-height: 1.55;
    }

    .setting-value {
      max-width: 220px;
      overflow: hidden;
      color: #cbd5e1;
      font-size: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .setting-badge {
      padding: 5px 10px;
      border-radius: 20px;
      color: #fbbf24;
      font-size: 12px;
      font-weight: 650;
      background:
        rgba(245, 158, 11, .16);
    }

    .setting-badge.enabled {
      color: #4ade80;
      background:
        rgba(34, 197, 94, .16);
    }

    .setting-action {
      min-width: 120px;
      min-height: 42px;
      padding: 0 16px;
      border: 1px solid #8b5cf6;
      border-radius: 7px;
      color: #c084fc;
      font-size: 13px;
      font-weight: 650;
      cursor: pointer;
      background: transparent;
    }

    .setting-action:hover {
      color: #fff;
      background:
        rgba(122, 64, 210, .14);
    }

    .setting-action.danger {
      border-color:
        rgba(244, 63, 94, .75);
      color: #fb7185;
    }

    .setting-action.danger:hover {
      background:
        rgba(190, 24, 93, .12);
    }

    .chevron-action {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border: 0;
      color: #8790a3;
      cursor: pointer;
      background: transparent;
    }

    @media (max-width: 650px) {
      .setting-card {
        grid-template-columns:
          auto minmax(0, 1fr);
      }

      .setting-action,
      .setting-value,
      .setting-badge,
      .chevron-action {
        grid-column: 2;
        justify-self: start;
      }
    }
  `,
})
export class SecuritySettingCardComponent {
    readonly title =
        input.required<string>();

    readonly description =
        input.required<string>();

    readonly icon =
        input.required<IconName>();

    readonly actionLabel =
        input<string | null>(null);

    readonly value =
        input<string | null>(null);

    readonly badge =
        input<string | null>(null);

    readonly badgeTone =
        input<'success' | 'warning'>(
            'warning',
        );

    readonly tone =
        input<SecurityCardTone>('default');

    readonly action = output<void>();
}