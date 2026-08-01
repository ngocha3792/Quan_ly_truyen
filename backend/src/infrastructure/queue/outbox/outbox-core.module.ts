import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';

import { OutboxWriterService } from './outbox-writer.service';
import { OutboxMetricsObserver } from './outbox-metrics.observer';

@Module({
  imports: [PrismaModule],
  providers: [OutboxWriterService, OutboxMetricsObserver],
  exports: [OutboxWriterService],
})
export class OutboxCoreModule {}
