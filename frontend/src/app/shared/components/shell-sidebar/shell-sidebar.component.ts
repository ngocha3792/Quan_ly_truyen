import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { APP_NAME } from '../../../core/config/app-identity.constants';
import { IconComponent, IconName } from '../icon/icon.component';

export interface ShellNavigationItem {
  readonly label: string;
  readonly route: string;
  readonly icon: IconName;
  readonly exact?: boolean;
  readonly badge?: number;
}

@Component({
  selector: 'app-shell-sidebar',
  standalone: true,

  imports: [RouterLink, RouterLinkActive, IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './shell-sidebar.component.html',

  styleUrl: './shell-sidebar.component.scss',
})
export class ShellSidebarComponent {
  protected readonly appName = APP_NAME;

  readonly brandSubtitle = input.required<string>();
  readonly navAriaLabel = input.required<string>();
  readonly navigationItems = input.required<readonly ShellNavigationItem[]>();

  readonly navigated = output<void>();
}
