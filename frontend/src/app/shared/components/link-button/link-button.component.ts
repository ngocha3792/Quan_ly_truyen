import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { ButtonVariant } from '../button/button.component';

@Component({
  selector: 'app-link-button',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './link-button.component.html',
  styleUrl: './link-button.component.scss',
})
export class LinkButtonComponent {
  readonly variant = input<ButtonVariant>('secondary');
  readonly routerLink = input.required<string | readonly (string | number)[]>();
  readonly queryParams = input<Record<string, unknown> | null>(null);
}
