import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database/prisma';

import { MediaCleanupService } from './application/media-cleanup.service';
import { DisabledMediaStorageAdapter } from './adapters/disabled-media-storage.adapter';
import { MediaQueryService } from './application/media-query.service';
import { MediaService } from './application/media.service';
import { MediaOwnershipAuthorizationService } from './application/media-ownership-authorization.service';
import { CloudinaryMediaAdapter } from './cloudinary/cloudinary-media.adapter';
import { cloudinaryProvider } from './cloudinary/cloudinary.provider';
import { CloudinarySignatureService } from './cloudinary/cloudinary-signature.service';
import { CloudinaryUrlService } from './cloudinary/cloudinary-url.service';
import { CloudinaryWebhookController } from './cloudinary/cloudinary-webhook.controller';
import { CloudinaryWebhookService } from './cloudinary/cloudinary-webhook.service';
import { CloudinaryWebhookInboxProcessor } from './cloudinary/cloudinary-webhook-inbox.processor';
import { CloudinaryWebhookMetricsObserver } from './cloudinary/cloudinary-webhook-metrics.observer';
import { MEDIA_STORAGE } from './contracts/media-storage.port';
import { ConfigService } from '@nestjs/config';
import { MediaPublicIdService } from './policies/media-public-id.service';
import { MediaController } from './media.controller';
import { ObservabilityModule } from '@/infrastructure/observability';

@Module({
  imports: [PrismaModule, ObservabilityModule],
  controllers: [MediaController, CloudinaryWebhookController],
  providers: [
    cloudinaryProvider,
    CloudinarySignatureService,
    CloudinaryUrlService,
    CloudinaryWebhookService,
    CloudinaryWebhookInboxProcessor,
    CloudinaryWebhookMetricsObserver,
    CloudinaryMediaAdapter,
    DisabledMediaStorageAdapter,
    MediaPublicIdService,
    MediaOwnershipAuthorizationService,
    {
      provide: MEDIA_STORAGE,
      inject: [
        ConfigService,
        CloudinaryMediaAdapter,
        DisabledMediaStorageAdapter,
      ],
      useFactory: (
        config: ConfigService,
        cloudinaryAdapter: CloudinaryMediaAdapter,
        disabledAdapter: DisabledMediaStorageAdapter,
      ) =>
        config.get<boolean>('cloudinary.enabled', false)
          ? cloudinaryAdapter
          : disabledAdapter,
    },
    MediaService,
    MediaQueryService,
    MediaCleanupService,
  ],
  exports: [
    MEDIA_STORAGE,
    MediaService,
    MediaQueryService,
    MediaCleanupService,
    CloudinaryUrlService,
    CloudinaryWebhookInboxProcessor,
  ],
})
export class MediaModule {}
