import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database/prisma';

import { MediaCleanupService } from './application/media-cleanup.service';
import { MediaQueryService } from './application/media-query.service';
import { MediaService } from './application/media.service';
import { CloudinaryMediaAdapter } from './cloudinary/cloudinary-media.adapter';
import { cloudinaryProvider } from './cloudinary/cloudinary.provider';
import { CloudinarySignatureService } from './cloudinary/cloudinary-signature.service';
import { CloudinaryUrlService } from './cloudinary/cloudinary-url.service';
import { CloudinaryWebhookController } from './cloudinary/cloudinary-webhook.controller';
import { CloudinaryWebhookService } from './cloudinary/cloudinary-webhook.service';
import { MEDIA_STORAGE } from './contracts/media-storage.port';

@Module({
  imports: [PrismaModule],
  controllers: [CloudinaryWebhookController],
  providers: [
    cloudinaryProvider,
    CloudinarySignatureService,
    CloudinaryUrlService,
    CloudinaryWebhookService,
    CloudinaryMediaAdapter,
    {
      provide: MEDIA_STORAGE,
      useExisting: CloudinaryMediaAdapter,
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
  ],
})
export class MediaModule {}
