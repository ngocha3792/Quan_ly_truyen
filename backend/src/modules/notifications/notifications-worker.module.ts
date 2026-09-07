import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { ObservabilityModule } from '@/infrastructure/observability';
import { OutboxCoreModule } from '@/infrastructure/queue/outbox';
import { NotificationsFanoutProcessor } from './infrastructure/queue/notifications-fanout.processor';
import { WeeklyReadingRecapScheduler } from './infrastructure/queue/weekly-reading-recap.scheduler';

@Module({
  imports: [PrismaModule, ObservabilityModule, OutboxCoreModule],
  providers: [NotificationsFanoutProcessor, WeeklyReadingRecapScheduler],
})
export class NotificationsWorkerModule {}
