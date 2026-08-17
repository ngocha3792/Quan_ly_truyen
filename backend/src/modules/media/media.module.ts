import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database/prisma';

import { MediaCleanupService } from './application/media-cleanup.service';
import { DisabledMediaStorageAdapter } from './infrastructure/storage/disabled-media-storage.adapter';
import { MediaQueryService } from './application/media-query.service';
import { MediaService } from './application/media.service';
import { MediaOwnershipAuthorizationService } from './application/media-ownership-authorization.service';
import { CloudinaryMediaAdapter } from './infrastructure/cloudinary/cloudinary-media.adapter';
import { cloudinaryProvider } from './infrastructure/cloudinary/cloudinary.provider';
import { CloudinarySignatureService } from './infrastructure/cloudinary/cloudinary-signature.service';
import { CloudinaryUrlService } from './infrastructure/cloudinary/cloudinary-url.service';
import { CloudinaryWebhookController } from './presentation/http/controllers/cloudinary-webhook.controller';
import { CloudinaryWebhookService } from './infrastructure/cloudinary/cloudinary-webhook.service';
import { CloudinaryWebhookInboxProcessor } from './infrastructure/cloudinary/cloudinary-webhook-inbox.processor';
import { CloudinaryWebhookMetricsObserver } from './infrastructure/cloudinary/cloudinary-webhook-metrics.observer';
import { MEDIA_STORAGE } from './application/ports/media-storage.port';
import { MEDIA_URL_BUILDER } from './application/ports/media-url.port';
import { ConfigService } from '@nestjs/config';
import { MediaPublicIdService } from './application/policies/media-public-id.service';
import { MediaController } from './presentation/http/controllers/media.controller';
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
    { provide: MEDIA_URL_BUILDER, useExisting: CloudinaryUrlService },
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
