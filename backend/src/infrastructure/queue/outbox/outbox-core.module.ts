import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { MailPayloadSecurityModule } from '@/infrastructure/mail/security';

import { OutboxWriterService } from './outbox-writer.service';
import { OutboxMetricsObserver } from './outbox-metrics.observer';

@Module({
  imports: [PrismaModule, MailPayloadSecurityModule],
  providers: [OutboxWriterService, OutboxMetricsObserver],
  exports: [OutboxWriterService],
})
export class OutboxCoreModule {}
