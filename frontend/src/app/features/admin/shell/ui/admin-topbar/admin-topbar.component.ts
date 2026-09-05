import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-admin-topbar',
  standalone: true,

  imports: [RouterLink, IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './admin-topbar.component.html',

  styleUrl: './admin-topbar.component.scss',
})
export class AdminTopbarComponent {
  @Output()
  readonly menuRequested = new EventEmitter<void>();
}
