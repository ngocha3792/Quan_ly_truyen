import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { UsersModule } from '@/modules/users';

import {
  CONTENT_TAKEDOWN_PERSISTENCE_PORT,
  MODERATION_METRICS_PORT,
  MODERATION_PERSISTENCE_PORT,
  BanUserCommandHandler,
  ModerateCommentCommandHandler,
  TakeDownChapterCommandHandler,
  TakeDownStoryCommandHandler,
  WarnUserCommandHandler,
} from './application';
import {
  MetricsModerationAdapter,
  PrismaContentTakedownPersistence,
  PrismaModerationPersistence,
} from './infrastructure';
import {
  AdminCommentModerationController,
  AdminContentTakedownController,
} from './presentation/http/controllers';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [
    AdminCommentModerationController,
    AdminContentTakedownController,
  ],
  providers: [
    BanUserCommandHandler,
    ModerateCommentCommandHandler,
    WarnUserCommandHandler,
    TakeDownChapterCommandHandler,
    TakeDownStoryCommandHandler,
    PrismaModerationPersistence,
    PrismaContentTakedownPersistence,
    MetricsModerationAdapter,
    {
      provide: MODERATION_PERSISTENCE_PORT,
      useExisting: PrismaModerationPersistence,
    },
    {
      provide: MODERATION_METRICS_PORT,
      useExisting: MetricsModerationAdapter,
    },
    {
      provide: CONTENT_TAKEDOWN_PERSISTENCE_PORT,
      useExisting: PrismaContentTakedownPersistence,
    },
  ],
})
export class ModerationModule {}
