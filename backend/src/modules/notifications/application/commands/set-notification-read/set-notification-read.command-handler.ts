import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  NOTIFICATION_PERSISTENCE_PORT,
  type NotificationPersistencePort,
} from '../../ports';

import { SetNotificationReadCommand } from './set-notification-read.command';

@Injectable()
export class SetNotificationReadCommandHandler {
  constructor(
    @Inject(NOTIFICATION_PERSISTENCE_PORT)
    private readonly persistence: NotificationPersistencePort,
  ) {}

  async execute(command: SetNotificationReadCommand): Promise<void> {
    const { userId, notificationId, isRead } = command;

    const notification = await this.persistence.findOneByUser(
      userId,
      notificationId,
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.persistence.setReadAt(
      notificationId,
      isRead ? new Date() : null,
    );
  }
}
