import { Module } from '@nestjs/common';

import { OutboxCoreModule } from './outbox-core.module';
import { OutboxDispatcherProcessor } from './outbox-dispatcher.processor';
import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { OutboxSchedulerService } from './outbox-scheduler.service';

@Module({
  imports: [OutboxCoreModule],
  providers: [
    OutboxDispatcherService,
    OutboxDispatcherProcessor,
    OutboxSchedulerService,
  ],
  exports: [OutboxCoreModule, OutboxDispatcherService],
})
export class OutboxModule {}
