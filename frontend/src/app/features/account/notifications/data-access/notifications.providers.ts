import { Provider } from '@angular/core';

import { NotificationsRepository } from '../domain/notifications.repository';
import { NotificationsHttpRepository } from './notifications-http.repository';

export function provideNotifications(): Provider[] {
  return [
    {
      provide: NotificationsRepository,
      useClass: NotificationsHttpRepository,
    },
  ];
}
