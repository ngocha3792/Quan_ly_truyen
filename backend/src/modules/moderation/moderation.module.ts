import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { UsersModule } from '@/modules/users';

import {
  MODERATION_METRICS_PORT,
  MODERATION_PERSISTENCE_PORT,
  BanUserCommandHandler,
  ModerateCommentCommandHandler,
  WarnUserCommandHandler,
} from './application';
import {
  MetricsModerationAdapter,
  PrismaModerationPersistence,
} from './infrastructure';
import { AdminCommentModerationController } from './presentation/http/controllers';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [AdminCommentModerationController],
  providers: [
    BanUserCommandHandler,
    ModerateCommentCommandHandler,
    WarnUserCommandHandler,
    PrismaModerationPersistence,
    MetricsModerationAdapter,
    {
      provide: MODERATION_PERSISTENCE_PORT,
      useExisting: PrismaModerationPersistence,
    },
    {
      provide: MODERATION_METRICS_PORT,
      useExisting: MetricsModerationAdapter,
    },
  ],
})
export class ModerationModule {}
