import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { ShellTopbarComponent } from '../../../../../shared/components/shell-topbar/shell-topbar.component';

@Component({
  selector: 'app-studio-topbar',
  standalone: true,

  imports: [RouterLink, IconComponent, ShellTopbarComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './studio-topbar.component.html',

  styleUrl: './studio-topbar.component.scss',
})
export class StudioTopbarComponent {
  @Input()
  unreadNotifications = 0;

  @Output()
  readonly menuRequested = new EventEmitter<void>();
}
