import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconComponent, IconName } from '../icon/icon.component';

export type StatCardTone = 'purple' | 'blue' | 'green' | 'orange' | 'pink' | 'indigo';

@Component({
  selector: 'app-stat-card',

  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <article class="stat-card" [attr.data-tone]="tone()">
      <span class="stat-icon">
        <app-icon [name]="icon()" [size]="iconSize()" />
      </span>

      <div class="stat-copy">
        <span class="stat-label">
          {{ label() }}
        </span>

        <strong class="stat-value">
          {{ value() }}
        </strong>

        @if (description()) {
          <small class="stat-description">
            {{ description() }}
          </small>
        }

        <ng-content select="[statMeta]" />
      </div>
    </article>
  `,

  styles: `
    :host {
      display: block;
      min-width: 0;

      height: var(--stat-host-height, auto);
    }

    .stat-card {
      min-height: var(--stat-min-height, 96px);

      height: 100%;

      padding: var(--stat-padding, 17px);

      display: flex;

      align-items: center;

      gap: var(--stat-gap, 15px);

      border: var(--stat-border, 1px solid var(--border));

      border-radius: var(--stat-radius, 12px);

      background: var(
        --stat-background,
        linear-gradient(145deg, rgba(17, 25, 44, 0.98), rgba(10, 16, 31, 0.98))
      );

      box-shadow: var(--stat-shadow, none);
    }

    .stat-icon {
      width: var(--stat-icon-size, 50px);

      height: var(--stat-icon-size, 50px);

      flex: 0 0 var(--stat-icon-size, 50px);

      display: grid;

      place-items: center;

      border-radius: var(--stat-icon-radius, 11px);

      color: #bd7ffa;

      background: rgba(125, 61, 204, 0.2);
    }

    .stat-card[data-tone='blue'] .stat-icon {
      color: #62adff;

      background: rgba(37, 99, 235, 0.18);
    }

    .stat-card[data-tone='green'] .stat-icon {
      color: #5ade7a;

      background: rgba(16, 185, 129, 0.18);
    }

    .stat-card[data-tone='orange'] .stat-icon {
      color: #f7a23d;

      background: rgba(217, 119, 6, 0.18);
    }

    .stat-card[data-tone='pink'] .stat-icon {
      color: #ff6da7;

      background: rgba(219, 39, 119, 0.18);
    }

    .stat-card[data-tone='indigo'] .stat-icon {
      color: #7c9cff;

      background: rgba(79, 70, 229, 0.18);
    }

    .stat-copy {
      min-width: 0;

      display: grid;

      gap: var(--stat-copy-gap, 3px);
    }

    .stat-label {
      overflow: hidden;

      color: var(--stat-label-color, #94a3b8);

      font-size: var(--stat-label-size, 12px);

      font-weight: var(--stat-label-weight, 600);

      text-overflow: ellipsis;

      white-space: nowrap;
    }

    .stat-value {
      overflow: hidden;

      color: var(--stat-value-color, #f8fafc);

      font-size: var(--stat-value-size, 21px);

      font-weight: var(--stat-value-weight, 700);

      line-height: var(--stat-value-line-height, 1.1);

      text-overflow: ellipsis;

      white-space: nowrap;
    }

    .stat-description {
      overflow: hidden;

      color: var(--stat-description-color, #94a3b8);

      font-size: var(--stat-description-size, 11.5px);

      text-overflow: ellipsis;

      white-space: nowrap;
    }
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();

  readonly value = input.required<string | number>();

  readonly description = input('');

  readonly icon = input.required<IconName>();

  readonly iconSize = input(24);

  readonly tone = input<StatCardTone>('purple');
}
