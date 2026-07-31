import { Module } from '@nestjs/common';

import { AppConfigModule } from './config';
import { InfrastructureModule } from './infrastructure';
import { OutboxModule } from './infrastructure/queue/outbox';

@Module({
  imports: [AppConfigModule, InfrastructureModule, OutboxModule],
})
export class WorkerModule {}
