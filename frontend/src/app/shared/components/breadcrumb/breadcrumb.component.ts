import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

export interface BreadcrumbItem {
  readonly label: string;
  readonly route?: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      @for (item of items(); track item.label; let last = $last) {
        @if (item.route && !last) {
          <a [routerLink]="item.route">{{ item.label }}</a>
        } @else {
          <span>{{ item.label }}</span>
        }

        @if (!last) {
          <span class="separator" aria-hidden="true">›</span>
        }
      }
    </nav>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #727c90;
      font-size: 0.85rem;
      margin-bottom: 0.25rem;
    }

    a {
      color: #a773ef;
      text-decoration: none;
    }

    a:hover {
      color: var(--primary-soft);
    }

    .separator {
      color: #727c90;
      font-weight: 400;
    }
  `,
})
export class BreadcrumbComponent {
  readonly items = input.required<readonly BreadcrumbItem[]>();
}
