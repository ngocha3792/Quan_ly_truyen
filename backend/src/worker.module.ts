import { Module } from '@nestjs/common';

import { AppConfigModule } from './config';
import { RedisModule } from './infrastructure/cache/redis/redis.module';
import { QueueWorkerHeartbeatService } from './infrastructure/health';
import { MailModule } from './infrastructure/mail';
import { CloudinaryWebhookInboxWorker } from './infrastructure/media/cloudinary/cloudinary-webhook-inbox.worker';
import { MediaModule } from './infrastructure/media';
import { ObservabilityModule } from './infrastructure/observability';
import { QueueModule } from './infrastructure/queue';
import { OutboxModule } from './infrastructure/queue/outbox';

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
      ? [RedisModule, QueueModule.register(), OutboxModule, MailModule]
      : []),
  ],
  providers: [
    CloudinaryWebhookInboxWorker,

    ...(queueWorkersEnabled ? [QueueWorkerHeartbeatService] : []),
  ],
})
export class WorkerModule {}
