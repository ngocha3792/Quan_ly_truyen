import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';

import { OutboxDispatcherProcessor } from './outbox-dispatcher.processor';
import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { OutboxSchedulerService } from './outbox-scheduler.service';
import { OutboxWriterService } from './outbox-writer.service';

@Module({
  imports: [PrismaModule],
  providers: [
    OutboxDispatcherService,
    OutboxDispatcherProcessor,
    OutboxSchedulerService,
    OutboxWriterService,
  ],
  exports: [OutboxDispatcherService, OutboxWriterService],
})
export class OutboxModule {}
