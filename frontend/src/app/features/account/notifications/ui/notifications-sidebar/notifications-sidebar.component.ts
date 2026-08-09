import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import {
  NotificationActivity,
  NotificationSettingKey,
  NotificationSettings,
  NotificationStatistics,
} from '../../domain/notifications.models';

@Component({
  selector: 'app-notifications-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './notifications-sidebar.component.html',

  styleUrl: './notifications-sidebar.component.scss',
})
export class NotificationsSidebarComponent {
  @Input({ required: true })
  statistics!: NotificationStatistics;

  @Input({ required: true })
  settings!: NotificationSettings;

  @Input({ required: true })
  activities: readonly NotificationActivity[] = [];

  @Input()
  unreadCount = 0;

  @Input()
  savedCount = 0;

  @Output()
  readonly settingToggle = new EventEmitter<NotificationSettingKey>();
}
