import { Injectable } from '@nestjs/common';

import { MediaStatus, MediaAsset } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma';

import { CloudinaryUrlService } from '../cloudinary/cloudinary-url.service';

@Injectable()
export class MediaQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly urlService: CloudinaryUrlService,
  ) {}

  async findById(id: string): Promise<MediaAsset | null> {
    return this.prisma.mediaAsset.findUnique({
      where: { id },
    });
  }

  getDeliveryUrl(
    media: MediaAsset,
    preset:
      | 'avatar'
      | 'authorBanner'
      | 'storyCover'
      | 'storyThumbnail'
      | 'chapterImage',
  ): string | null {
    if (media.status !== MediaStatus.READY || !media.publicId) {
      return null;
    }

    const resourceType =
      media.resourceType?.toLowerCase() === 'video' ? 'video' : 'image';

    return this.urlService.build({
      publicId: media.publicId,
      resourceType,
      preset,
    });
  }
}
