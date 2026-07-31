import { Injectable } from '@nestjs/common';
import {
  MediaAsset,
  MediaPurpose,
  MediaResourceType,
  MediaStatus,
} from '@/generated/prisma/client';
import {
  InvalidInputException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import { PrismaService } from '@/infrastructure/database/prisma';
import { CloudinaryUrlService } from '../cloudinary/cloudinary-url.service';
import { MediaOwnershipAuthorizationService } from './media-ownership-authorization.service';

@Injectable()
export class MediaQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly urlService: CloudinaryUrlService,
    private readonly ownership: MediaOwnershipAuthorizationService,
  ) {}

  async findById(id: string): Promise<MediaAsset | null> {
    return this.prisma.mediaAsset.findUnique({ where: { id } });
  }

  async getAccessibleById(id: string, userId: string): Promise<MediaAsset> {
    const media = await this.findById(id);
    if (!media || media.status !== MediaStatus.READY)
      throw new ResourceNotFoundException({
        resource: 'media asset',
        identifier: id,
      });
    this.ownership.assertUploader(userId, media.uploaderId);
    return media;
  }

  getDeliveryUrl(media: MediaAsset): string | null {
    if (media.status !== MediaStatus.READY || !media.publicId) return null;
    if (media.resourceType === MediaResourceType.RAW) return media.secureUrl;
    if (media.resourceType !== MediaResourceType.IMAGE) return media.secureUrl;
    const preset = purposePreset(media.purpose);
    if (!preset)
      throw new InvalidInputException({
        message: 'Media purpose không hỗ trợ image transformation',
      });
    return this.urlService.build({
      publicId: media.publicId,
      resourceType: 'image',
      preset,
    });
  }
}

function purposePreset(
  purpose: MediaPurpose,
): 'avatar' | 'authorBanner' | 'storyCover' | 'chapterImage' | null {
  const map: Partial<
    Record<
      MediaPurpose,
      'avatar' | 'authorBanner' | 'storyCover' | 'chapterImage'
    >
  > = {
    AVATAR: 'avatar',
    AUTHOR_BANNER: 'authorBanner',
    STORY_COVER: 'storyCover',
    CHAPTER_IMAGE: 'chapterImage',
  };
  return map[purpose] ?? null;
}
