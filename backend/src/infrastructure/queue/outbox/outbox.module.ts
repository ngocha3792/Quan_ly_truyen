import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';

import { QueueModule } from '../queue.module';

import { OutboxDispatcherProcessor } from './outbox-dispatcher.processor';
import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { OutboxSchedulerService } from './outbox-scheduler.service';

@Module({
  imports: [PrismaModule, QueueModule.register()],
  providers: [
    OutboxDispatcherService,
    OutboxDispatcherProcessor,
    OutboxSchedulerService,
  ],
  exports: [OutboxDispatcherService],
})
export class OutboxModule {}
