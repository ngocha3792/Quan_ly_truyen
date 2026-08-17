import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { UsersModule } from '@/modules/users';
import {
  MODERATION_METRICS_PORT,
  MODERATION_PERSISTENCE_PORT,
  ModerationService,
} from './application';
import { AdminCommentModerationController } from './presentation/http/admin-comment-moderation.controller';
import {
  MetricsModerationAdapter,
  PrismaModerationPersistence,
} from './infrastructure';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [AdminCommentModerationController],
  providers: [
    ModerationService,
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
