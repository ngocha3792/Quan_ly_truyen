import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaModule } from '@/infrastructure/database/prisma';
import { ObservabilityModule } from '@/infrastructure/observability';

import {
  MEDIA_CLEANUP_PORT,
  MEDIA_COMMAND_PORT,
  MEDIA_QUERY_PORT,
  MEDIA_STORAGE,
  MEDIA_URL_BUILDER,
  MEDIA_WEBHOOK_PORT,
  CleanupStaleMediaCommandHandler,
  ConfirmMediaUploadCommandHandler,
  CreateMediaUploadIntentCommandHandler,
  DeleteMediaCommandHandler,
  GetMediaQueryHandler,
  ProcessMediaWebhookCommandHandler,
} from './application';
import { MediaPublicIdPolicy } from './domain';
import {
  CloudinaryMediaAdapter,
  CloudinarySignatureAdapter,
  CloudinaryUrlAdapter,
  CloudinaryWebhookInboxProcessor,
  CloudinaryWebhookMetricsObserver,
  CloudinaryWebhookAdapter,
  DisabledMediaStorageAdapter,
  PrismaMediaCleanupAdapter,
  PrismaMediaCommandAdapter,
  PrismaMediaOwnershipAdapter,
  PrismaMediaQueryAdapter,
  cloudinaryProvider,
} from './infrastructure';
import {
  CloudinaryWebhookController,
  MediaController,
} from './presentation/http/controllers';

@Module({
  imports: [PrismaModule, ObservabilityModule],
  controllers: [MediaController, CloudinaryWebhookController],
  providers: [
    cloudinaryProvider,
    CloudinarySignatureAdapter,
    CloudinaryUrlAdapter,
    CloudinaryWebhookAdapter,
    CloudinaryWebhookInboxProcessor,
    CloudinaryWebhookMetricsObserver,
    CloudinaryMediaAdapter,
    DisabledMediaStorageAdapter,
    MediaPublicIdPolicy,
    PrismaMediaOwnershipAdapter,
    PrismaMediaCommandAdapter,
    PrismaMediaQueryAdapter,
    PrismaMediaCleanupAdapter,
    CreateMediaUploadIntentCommandHandler,
    ConfirmMediaUploadCommandHandler,
    DeleteMediaCommandHandler,
    CleanupStaleMediaCommandHandler,
    GetMediaQueryHandler,
    ProcessMediaWebhookCommandHandler,
    { provide: MEDIA_URL_BUILDER, useExisting: CloudinaryUrlAdapter },
    { provide: MEDIA_COMMAND_PORT, useExisting: PrismaMediaCommandAdapter },
    { provide: MEDIA_QUERY_PORT, useExisting: PrismaMediaQueryAdapter },
    { provide: MEDIA_CLEANUP_PORT, useExisting: PrismaMediaCleanupAdapter },
    { provide: MEDIA_WEBHOOK_PORT, useExisting: CloudinaryWebhookAdapter },
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
  ],
  exports: [
    MEDIA_STORAGE,
    CloudinaryUrlAdapter,
    CloudinaryWebhookInboxProcessor,
    CleanupStaleMediaCommandHandler,
  ],
})
export class MediaModule {}
