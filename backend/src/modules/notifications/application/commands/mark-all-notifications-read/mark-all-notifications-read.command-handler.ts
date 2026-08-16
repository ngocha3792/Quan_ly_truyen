import { Inject, Injectable } from '@nestjs/common';

import {
  NOTIFICATION_PERSISTENCE_PORT,
  type NotificationPersistencePort,
} from '../../ports';

import { MarkAllNotificationsReadCommand } from './mark-all-notifications-read.command';

@Injectable()
export class MarkAllNotificationsReadCommandHandler {
  constructor(
    @Inject(NOTIFICATION_PERSISTENCE_PORT)
    private readonly persistence: NotificationPersistencePort,
  ) {}

  async execute(command: MarkAllNotificationsReadCommand): Promise<void> {
    await this.persistence.markAllRead(command.userId, new Date());
  }
}
