import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import { OutboxCoreModule } from '@/infrastructure/queue/outbox';

import {
  GetNotificationViewQueryHandler,
  MarkAllNotificationsReadCommandHandler,
  NOTIFICATION_PERSISTENCE_PORT,
  SetNotificationReadCommandHandler,
  SetNotificationSavedCommandHandler,
  UpdateNotificationSettingsCommandHandler,
} from './application';
import {
  PrismaNotificationPersistence,
  TransactionalReceiptService,
} from './infrastructure';
import { NotificationsController } from './presentation/http';

const portProviders = [
  {
    provide: NOTIFICATION_PERSISTENCE_PORT,
    useExisting: PrismaNotificationPersistence,
  },
];

const applicationHandlers = [
  GetNotificationViewQueryHandler,
  SetNotificationReadCommandHandler,
  SetNotificationSavedCommandHandler,
  MarkAllNotificationsReadCommandHandler,
  UpdateNotificationSettingsCommandHandler,
];

@Module({
  imports: [PrismaModule, AuthAuthorizationModule, OutboxCoreModule],
  controllers: [NotificationsController],
  providers: [
    PrismaNotificationPersistence,
    TransactionalReceiptService,
    ...portProviders,
    ...applicationHandlers,
  ],
  exports: [TransactionalReceiptService],
})
export class NotificationsModule {}
