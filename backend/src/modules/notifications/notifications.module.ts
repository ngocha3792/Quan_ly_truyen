import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  GetNotificationViewCommandHandler,
  MarkAllNotificationsReadCommandHandler,
  NOTIFICATION_PERSISTENCE_PORT,
  SetNotificationReadCommandHandler,
  SetNotificationSavedCommandHandler,
  UpdateNotificationSettingsCommandHandler,
} from './application';
import { PrismaNotificationPersistence } from './infrastructure';
import { NotificationsController } from './presentation/http';

const portProviders = [
  {
    provide: NOTIFICATION_PERSISTENCE_PORT,
    useExisting: PrismaNotificationPersistence,
  },
];

const commandHandlers = [
  GetNotificationViewCommandHandler,
  SetNotificationReadCommandHandler,
  SetNotificationSavedCommandHandler,
  MarkAllNotificationsReadCommandHandler,
  UpdateNotificationSettingsCommandHandler,
];

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [NotificationsController],
  providers: [
    PrismaNotificationPersistence,
    ...portProviders,
    ...commandHandlers,
  ],
})
export class NotificationsModule {}
