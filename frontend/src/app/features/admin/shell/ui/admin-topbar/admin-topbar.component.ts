import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { ShellTopbarComponent } from '../../../../../shared/components/shell-topbar/shell-topbar.component';

@Component({
  selector: 'app-admin-topbar',
  standalone: true,

  imports: [RouterLink, IconComponent, ShellTopbarComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './admin-topbar.component.html',

  styleUrl: './admin-topbar.component.scss',
})
export class AdminTopbarComponent {
  @Output()
  readonly menuRequested = new EventEmitter<void>();
}
