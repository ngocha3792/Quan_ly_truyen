import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  NOTIFICATION_PERSISTENCE_PORT,
  type NotificationPersistencePort,
} from '../../ports';

import { SetNotificationSavedCommand } from './set-notification-saved.command';

@Injectable()
export class SetNotificationSavedCommandHandler {
  constructor(
    @Inject(NOTIFICATION_PERSISTENCE_PORT)
    private readonly persistence: NotificationPersistencePort,
  ) {}

  async execute(command: SetNotificationSavedCommand): Promise<void> {
    const { userId, notificationId, isSaved } = command;

    const notification = await this.persistence.findOneByUser(
      userId,
      notificationId,
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const existingData = this.asRecord(notification.data);

    await this.persistence.updateData(notificationId, {
      ...existingData,
      saved: isSaved,
    });
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }
}
