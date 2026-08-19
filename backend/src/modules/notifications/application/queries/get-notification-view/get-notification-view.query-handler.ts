import { Inject, Injectable } from '@nestjs/common';

import type { NotificationViewDto } from '../../dto';
import { NotificationItemMapper } from '../../mappers/notification-item.mapper';
import { NotificationSettingsMapper } from '../../mappers/notification-settings.mapper';
import {
  NOTIFICATION_PERSISTENCE_PORT,
  type NotificationPersistencePort,
} from '../../ports';

import { GetNotificationViewQuery } from './get-notification-view.query';

@Injectable()
export class GetNotificationViewQueryHandler {
  constructor(
    @Inject(NOTIFICATION_PERSISTENCE_PORT)
    private readonly persistence: NotificationPersistencePort,
  ) {}

  async execute(query: GetNotificationViewQuery): Promise<NotificationViewDto> {
    const { userId } = query;
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [rawNotifications, total, unread, receivedToday, preference] =
      await Promise.all([
        this.persistence.findManyByUser(userId, now, 200),
        this.persistence.countByUser(userId, now),
        this.persistence.countUnreadByUser(userId, now),
        this.persistence.countTodayByUser(userId, startOfToday, now),
        this.persistence.findPreference(userId),
      ]);

    const notifications = rawNotifications.map((n) =>
      NotificationItemMapper.toDto(n, now),
    );

    return {
      notifications,
      statistics: {
        total,
        unread,
        saved: notifications.filter((n) => n.isSaved).length,
        receivedToday,
      },
      settings: NotificationSettingsMapper.toDto(preference),
      recentActivities: notifications.slice(0, 3).map((n) => ({
        id: `activity-${n.id}`,
        time: n.createdAt,
        description: n.title,
      })),
    };
  }
}
