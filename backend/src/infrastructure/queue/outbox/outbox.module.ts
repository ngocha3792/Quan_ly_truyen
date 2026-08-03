import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';

import { MailPayloadSecurityModule } from '@/infrastructure/mail/security';

import { OutboxMetricsObserver } from './outbox-metrics.observer';

import { OutboxWriterService } from './outbox-writer.service';

@Module({
  imports: [PrismaModule, MailPayloadSecurityModule],

  providers: [OutboxWriterService, OutboxMetricsObserver],

  exports: [OutboxWriterService],
})
export class OutboxCoreModule {}
