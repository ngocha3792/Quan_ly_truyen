import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { ObservabilityModule } from '@/infrastructure/observability';
import { NotificationsFanoutProcessor } from './infrastructure/queue/notifications-fanout.processor';

@Module({
  imports: [PrismaModule, ObservabilityModule],
  providers: [NotificationsFanoutProcessor],
})
export class NotificationsWorkerModule {}
