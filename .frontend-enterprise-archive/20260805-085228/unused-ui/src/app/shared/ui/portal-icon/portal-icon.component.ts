import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type PortalIconName =
  | 'activity'
  | 'arrow-left'
  | 'arrow-right'
  | 'bell'
  | 'book'
  | 'bookmark'
  | 'calendar'
  | 'chart'
  | 'chevron-down'
  | 'clock'
  | 'coin'
  | 'comment'
  | 'dashboard'
  | 'edit'
  | 'eye'
  | 'file'
  | 'fire'
  | 'heart'
  | 'info'
  | 'library'
  | 'menu'
  | 'more'
  | 'notification'
  | 'play'
  | 'plus'
  | 'ranking'
  | 'search'
  | 'settings'
  | 'star'
  | 'user'
  | 'users'
  | 'write'
  | 'x';

@Component({
  selector: 'app-portal-icon',
  standalone: true,
  templateUrl: './portal-icon.component.html',
  styleUrls: ['./portal-icon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalIconComponent {
  @Input({ required: true }) name: PortalIconName = 'book';
  @Input() strokeWidth = 1.8;
}
