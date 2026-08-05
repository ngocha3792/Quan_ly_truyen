import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type AccountCenterIconName =
  | 'activity'
  | 'arrow-left'
  | 'arrow-right'
  | 'bell'
  | 'book'
  | 'bookmark'
  | 'calendar'
  | 'camera'
  | 'check'
  | 'chevron-down'
  | 'clock'
  | 'comment'
  | 'crown'
  | 'dashboard'
  | 'edit'
  | 'eye'
  | 'filter'
  | 'globe'
  | 'heart'
  | 'history'
  | 'library'
  | 'lock'
  | 'logout'
  | 'mail'
  | 'menu'
  | 'moon'
  | 'more'
  | 'palette'
  | 'phone'
  | 'search'
  | 'settings'
  | 'shield'
  | 'sort'
  | 'star'
  | 'trash'
  | 'user'
  | 'x';

@Component({
  selector: 'app-account-center-icon',
  standalone: true,
  templateUrl: './account-center-icon.component.html',
  styleUrls: ['./account-center-icon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountCenterIconComponent {
  @Input({ required: true }) name: AccountCenterIconName = 'book';
  @Input() strokeWidth = 1.8;
}
