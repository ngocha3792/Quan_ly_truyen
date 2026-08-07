import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconComponent, IconName } from '../icon/icon.component';

@Component({
  selector: 'app-empty-state',

  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="empty-state">
      @if (icon(); as iconName) {
        <span class="empty-icon">
          <app-icon [name]="iconName" [size]="iconSize()" />
        </span>
      }

      <div class="empty-copy">
        <strong>
          {{ title() }}
        </strong>

        @if (description()) {
          <p>
            {{ description() }}
          </p>
        }
      </div>

      <ng-content select="[emptyAction]" />
    </section>
  `,

  styles: `
    :host {
      display: block;
      min-width: 0;

      grid-column: var(--empty-grid-column, auto);
    }

    .empty-state {
      min-height: var(--empty-min-height, 240px);

      padding: var(--empty-padding, 24px);

      display: grid;

      place-items: center;

      align-content: center;

      gap: var(--empty-gap, 10px);

      color: var(--empty-icon-color, #a76def);

      text-align: center;
    }

    .empty-icon {
      width: var(--empty-icon-box-size, auto);

      height: var(--empty-icon-box-size, auto);

      display: grid;

      place-items: center;

      border-radius: var(--empty-icon-radius, 50%);

      color: var(--empty-icon-color, #a76def);

      background: var(--empty-icon-background, transparent);
    }

    .empty-copy {
      display: grid;

      gap: var(--empty-copy-gap, 6px);
    }

    strong {
      color: var(--empty-title-color, #e2dfe8);

      font-size: var(--empty-title-size, 1rem);

      font-weight: var(--empty-title-weight, 700);
    }

    p {
      max-width: var(--empty-description-max-width, 380px);

      margin: 0;

      color: var(--empty-description-color, #717b90);

      font-size: var(--empty-description-size, 0.85rem);

      line-height: var(--empty-description-line-height, 1.6);
    }
  `,
})
export class EmptyStateComponent {
  readonly icon = input<IconName | null>(null);

  readonly iconSize = input(30);

  readonly title = input.required<string>();

  readonly description = input('');
}
