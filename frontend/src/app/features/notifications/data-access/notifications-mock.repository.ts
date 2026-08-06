
import { Injectable } from '@angular/core';

import { NotificationsView } from '../domain/notifications.models';
import { NotificationsRepository } from '../domain/notifications.repository';
import { NOTIFICATIONS_MOCK } from '../mock/notifications.mock';

@Injectable()
export class NotificationsMockRepository
    implements NotificationsRepository {
    getNotifications(): NotificationsView {
        return NOTIFICATIONS_MOCK;
    }
}