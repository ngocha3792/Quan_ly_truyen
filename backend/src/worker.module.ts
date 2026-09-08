import { Module } from '@nestjs/common';

import { AppConfigModule } from './config';
import { RedisModule } from './infrastructure/cache/redis/redis.module';
import { QueueWorkerHeartbeatService } from './infrastructure/health';
import { MailModule } from './infrastructure/mail';
import { CloudinaryWebhookInboxWorker } from './modules/media/infrastructure/cloudinary/cloudinary-webhook-inbox.worker';
import { MediaModule } from './modules/media';
import { ObservabilityModule } from './infrastructure/observability';
import { QueueModule } from './infrastructure/queue';
import { OutboxModule } from './infrastructure/queue/outbox';
import { NotificationsWorkerModule } from './modules/notifications';
import { AnalyticsWorkerModule } from './modules/analytics';
import { AiWorkerModule } from './modules/ai';
import { ChaptersWorkerModule } from './modules/chapters';
import { BillingWorkerModule } from './modules/billing';
import { CommentsWorkerModule } from './modules/comments';

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
      ? [
          RedisModule,
          QueueModule.register(),
          OutboxModule,
          MailModule,
          NotificationsWorkerModule,
          AnalyticsWorkerModule,
          AiWorkerModule,
          ChaptersWorkerModule,
          BillingWorkerModule,
          CommentsWorkerModule,
        ]
      : []),
  ],
  providers: [
    CloudinaryWebhookInboxWorker,

    ...(queueWorkersEnabled ? [QueueWorkerHeartbeatService] : []),
  ],
})
export class WorkerModule {}
