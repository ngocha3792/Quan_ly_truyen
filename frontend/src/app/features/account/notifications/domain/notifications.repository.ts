import { NotificationsView } from './notifications.models';

export abstract class NotificationsRepository {
  abstract getNotifications(): NotificationsView;
}
