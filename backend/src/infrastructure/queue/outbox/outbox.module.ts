import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { MailPayloadSecurityModule } from '@/infrastructure/mail/security';
import { ObservabilityModule } from '@/infrastructure/observability';

import { OutboxDispatcherProcessor } from './outbox-dispatcher.processor';
import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { OutboxMetricsObserver } from './outbox-metrics.observer';
import { OutboxRetentionService } from './outbox-retention.service';
import { OutboxSchedulerService } from './outbox-scheduler.service';
import { OutboxWriterService } from './outbox-writer.service';

@Module({
  imports: [PrismaModule, MailPayloadSecurityModule, ObservabilityModule],
  providers: [
    OutboxWriterService,
    OutboxMetricsObserver,
    OutboxDispatcherService,
    OutboxDispatcherProcessor,
    OutboxSchedulerService,
    OutboxRetentionService,
  ],
  exports: [
    OutboxWriterService,
    OutboxMetricsObserver,
    OutboxDispatcherService,
    OutboxRetentionService,
  ],
})
export class OutboxModule {}
