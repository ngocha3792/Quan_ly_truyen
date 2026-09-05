import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AdminSidebarComponent } from '../../ui/admin-sidebar/admin-sidebar.component';
import { AdminTopbarComponent } from '../../ui/admin-topbar/admin-topbar.component';

@Component({
  selector: 'app-admin-shell',
  standalone: true,

  imports: [RouterOutlet, AdminSidebarComponent, AdminTopbarComponent],

  templateUrl: './admin-shell.component.html',

  styleUrl: './admin-shell.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShellComponent {
  protected readonly mobileOpen = signal(false);

  protected toggleMobile(): void {
    this.mobileOpen.update((value) => !value);
  }

  protected closeMobile(): void {
    this.mobileOpen.set(false);
  }
}
