import { Module } from '@nestjs/common';

import { AppConfigModule } from './config';
import { InfrastructureModule } from './infrastructure';
import { MailModule } from './infrastructure/mail';
import { OutboxModule } from './infrastructure/queue/outbox';

@Module({
  imports: [AppConfigModule, InfrastructureModule, OutboxModule, MailModule],
})
export class WorkerModule {}
