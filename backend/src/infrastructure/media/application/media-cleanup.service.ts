import { Inject, Injectable } from '@nestjs/common';

import { MediaStatus } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma';

import {
  MEDIA_STORAGE,
  MediaStoragePort,
} from '../contracts/media-storage.port';

@Injectable()
export class MediaCleanupService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE)
    private readonly mediaStorage: MediaStoragePort,
  ) {}

  async deleteById(mediaId: string): Promise<void> {
    const media = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
    });

    if (!media || media.status === MediaStatus.DELETED) {
      return;
    }

    if (!media.publicId || !media.resourceType) {
      await this.prisma.mediaAsset.update({
        where: { id: media.id },
        data: {
          status: MediaStatus.DELETED,
          deletedAt: new Date(),
        },
      });
      return;
    }

    try {
      await this.mediaStorage.delete({
        publicId: media.publicId,
        resourceType: media.resourceType.toLowerCase() as any,
        invalidate: true,
      });

      await this.prisma.mediaAsset.update({
        where: { id: media.id },
        data: {
          status: MediaStatus.DELETED,
          deletedAt: new Date(),
        },
      });
    } catch (error: unknown) {
      await this.prisma.mediaAsset.update({
        where: { id: media.id },
        data: {
          status: MediaStatus.DELETE_FAILED,
          metadata: {
            deleteFailureAt: new Date().toISOString(),
          },
        },
      });

      throw error;
    }
  }
}
