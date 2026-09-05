import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-shell-topbar',
  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './shell-topbar.component.html',

  styleUrl: './shell-topbar.component.scss',
})
export class ShellTopbarComponent {
  readonly menuRequested = output<void>();
}
