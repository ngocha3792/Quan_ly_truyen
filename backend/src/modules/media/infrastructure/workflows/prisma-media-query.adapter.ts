import { Inject, Injectable } from '@nestjs/common';
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
import type { AuthPrincipal } from '@/common/interfaces/auth';
import { PrismaService } from '@/infrastructure/database/prisma';
import {
  MEDIA_URL_BUILDER,
  type MediaUrlPort,
} from '../../application/ports/media-url.port';
import { PrismaMediaOwnershipAdapter } from '../persistence/prisma-media-ownership.adapter';
import type { MediaQueryPort } from '../../application/ports';

@Injectable()
export class PrismaMediaQueryAdapter implements MediaQueryPort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_URL_BUILDER) private readonly urlService: MediaUrlPort,
    private readonly ownership: PrismaMediaOwnershipAdapter,
  ) {}

  async findById(id: string): Promise<MediaAsset | null> {
    return this.prisma.mediaAsset.findUnique({ where: { id } });
  }

  async getAccessibleById(
    id: string,
    principal: AuthPrincipal,
  ): Promise<MediaAsset> {
    const media = await this.findById(id);
    if (!media || media.status !== MediaStatus.READY)
      throw new ResourceNotFoundException({
        resource: 'media asset',
        identifier: id,
      });
    this.ownership.assertUploader(principal, media.uploaderId);
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
