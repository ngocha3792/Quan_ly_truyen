import { Observable } from 'rxjs';

import { NotificationSettings, NotificationsView } from './notifications.models';

export abstract class NotificationsRepository {
  abstract getNotifications(): Observable<NotificationsView>;
  abstract setRead(notificationId: string, isRead: boolean): Observable<void>;
  abstract setSaved(notificationId: string, isSaved: boolean): Observable<void>;
  abstract markAllAsRead(): Observable<void>;
  abstract updateSettings(
    settings: Partial<NotificationSettings>,
  ): Observable<NotificationSettings>;
}
