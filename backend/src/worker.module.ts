import { Module } from '@nestjs/common';

import { AppConfigModule } from './config';
import { MailModule } from './infrastructure/mail';
import { MediaModule } from './infrastructure/media';
import { QueueModule } from './infrastructure/queue';
import { OutboxModule } from './infrastructure/queue/outbox';
import { CloudinaryWebhookInboxWorker } from './infrastructure/media/cloudinary/cloudinary-webhook-inbox.worker';
import { ObservabilityModule } from './infrastructure/observability';

const queueWorkersEnabled =
  process.env.QUEUE_ENABLED === 'true' &&
  process.env.REDIS_ENABLED === 'true' &&
  ['all', 'queue'].includes(process.env.WORKER_ROLE ?? 'all');

@Module({
  imports: [
    AppConfigModule,
    ObservabilityModule,
    MediaModule,
    ...(queueWorkersEnabled
      ? [QueueModule.register(), OutboxModule, MailModule]
      : []),
  ],
  providers: [CloudinaryWebhookInboxWorker],
})
export class WorkerModule {}
