import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconComponent, IconName } from '../icon/icon.component';

@Component({
  selector: 'app-page-heading',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-heading">
      <div>
        <h1>
          {{ title() }}
          @if (icon()) {
            <app-icon [name]="$any(icon())" [size]="18" />
          }
        </h1>

        @if (description()) {
          <p>{{ description() }}</p>
        }
      </div>
      <ng-content />
    </header>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .page-heading {
      margin: 0 0 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.25rem;
    }

    h1 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      color: #f8f6fb;
      font-size: clamp(1.65rem, 2.8vw, 2.1rem);
      font-style: normal;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }

    h1 app-icon {
      color: #a868ef;
    }

    p {
      margin: 0.45rem 0 0;
      color: #7f899d;
      font-size: 0.85rem;
      line-height: 1.6;
    }
  `,
})
export class PageHeadingComponent {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly icon = input<IconName | null>(null);
}
