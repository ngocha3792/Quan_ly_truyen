import { Provider } from '@angular/core';

import { NotificationsRepository } from '../domain/notifications.repository';
import { NotificationsMockRepository } from './notifications-mock.repository';

export function provideNotifications(): Provider[] {
  return [
    {
      provide: NotificationsRepository,
      useClass: NotificationsMockRepository,
    },
  ];
}
