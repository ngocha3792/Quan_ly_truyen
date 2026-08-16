import { Inject, Injectable } from '@nestjs/common';

import type { NotificationSettingsDto } from '../../dto';
import { NotificationSettingsMapper } from '../../mappers/notification-settings.mapper';
import {
  NOTIFICATION_PERSISTENCE_PORT,
  type NotificationPersistencePort,
} from '../../ports';

import { UpdateNotificationSettingsCommand } from './update-notification-settings.command';

@Injectable()
export class UpdateNotificationSettingsCommandHandler {
  constructor(
    @Inject(NOTIFICATION_PERSISTENCE_PORT)
    private readonly persistence: NotificationPersistencePort,
  ) {}

  async execute(
    command: UpdateNotificationSettingsCommand,
  ): Promise<NotificationSettingsDto> {
    const preference = await this.persistence.upsertPreference({
      userId: command.userId,
      newChapters: command.newChapters,
      comments: command.comments,
      system: command.system,
      promotions: command.promotions,
    });

    return NotificationSettingsMapper.toDto(preference);
  }
}
