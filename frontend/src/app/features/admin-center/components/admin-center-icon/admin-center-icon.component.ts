import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type AdminCenterIconName =
  | 'activity'
  | 'ads'
  | 'bell'
  | 'book'
  | 'calendar'
  | 'category'
  | 'chart'
  | 'check'
  | 'chevron-down'
  | 'coin'
  | 'comment'
  | 'dashboard'
  | 'edit'
  | 'eye'
  | 'filter'
  | 'flag'
  | 'image'
  | 'lock'
  | 'logout'
  | 'menu'
  | 'more'
  | 'plus'
  | 'search'
  | 'settings'
  | 'shield'
  | 'star'
  | 'trash'
  | 'user'
  | 'users';

@Component({
  selector: 'app-admin-center-icon',
  standalone: true,
  templateUrl: './admin-center-icon.component.html',
  styleUrls: ['./admin-center-icon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCenterIconComponent {
  @Input({ required: true }) name: AdminCenterIconName = 'dashboard';
}
