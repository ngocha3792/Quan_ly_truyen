import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { SearchFieldComponent } from '../../../../../shared/components/search-field/search-field.component';

import { NotificationCategory } from '../../domain/notifications.models';

@Component({
  selector: 'app-notifications-toolbar',

  standalone: true,

  imports: [SearchFieldComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './notifications-toolbar.component.html',

  styleUrl: './notifications-toolbar.component.scss',
})
export class NotificationsToolbarComponent {
  @Input()
  query = '';

  @Input()
  category: NotificationCategory = 'all';

  @Input()
  unreadCount = 0;

  @Output()
  readonly queryChange = new EventEmitter<string>();

  @Output()
  readonly categoryChange = new EventEmitter<NotificationCategory>();

  @Output()
  readonly markAllAsRead = new EventEmitter<void>();
}
