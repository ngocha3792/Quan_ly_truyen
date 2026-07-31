import { Module } from '@nestjs/common';

import { AppConfigModule } from './config';
import { InfrastructureModule } from './infrastructure';
import { MailModule } from './infrastructure/mail';
import { OutboxModule } from './infrastructure/queue/outbox';
import { CloudinaryWebhookInboxWorker } from './infrastructure/media/cloudinary/cloudinary-webhook-inbox.worker';

const queueWorkersEnabled =
  process.env.QUEUE_ENABLED === 'true' && process.env.REDIS_ENABLED === 'true';

@Module({
  imports: [
    AppConfigModule,
    InfrastructureModule,
    ...(queueWorkersEnabled ? [OutboxModule, MailModule] : []),
  ],
  providers: [CloudinaryWebhookInboxWorker],
})
export class WorkerModule {}
