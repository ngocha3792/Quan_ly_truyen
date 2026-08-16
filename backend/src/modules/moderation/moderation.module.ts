import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { UsersModule } from '@/modules/users';
import { ModerationService } from './application';
import { AdminCommentModerationController } from './presentation/http/admin-comment-moderation.controller';
import { AdminReportsController } from './presentation/http/admin-reports.controller';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [AdminReportsController, AdminCommentModerationController],
  providers: [ModerationService],
})
export class ModerationModule {}
