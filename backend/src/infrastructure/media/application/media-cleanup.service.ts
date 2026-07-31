import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  MediaAsset,
  MediaResourceType,
  MediaStatus,
  Prisma,
} from '@/generated/prisma/client';
import {
  InvalidStateTransitionException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import { PrismaService } from '@/infrastructure/database/prisma';
import {
  MEDIA_STORAGE,
  MediaStoragePort,
} from '../contracts/media-storage.port';
import type { MediaStorageResourceType } from '../contracts/stored-media.interface';
import { MEDIA_ERROR_CODES } from '../media-error-codes';
import { MediaOwnershipAuthorizationService } from './media-ownership-authorization.service';

export interface CleanupSummary {
  scanned: number;
  deleted: number;
  failed: number;
  skipped: number;
}

@Injectable()
export class MediaCleanupService {
  private readonly logger = new Logger(MediaCleanupService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly mediaStorage: MediaStoragePort,
    private readonly ownership: MediaOwnershipAuthorizationService,
  ) {}

  async deleteById(mediaId: string, userId?: string): Promise<void> {
    const media = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
    });
    if (!media)
      throw new ResourceNotFoundException({
        resource: 'media asset',
        identifier: mediaId,
      });
    if (userId) this.ownership.assertUploader(userId, media.uploaderId);
    if (media.status === MediaStatus.DELETED) return;
    const claim = await this.prisma.mediaAsset.updateMany({
      where: {
        id: mediaId,
        status: { in: [MediaStatus.READY, MediaStatus.DELETE_FAILED] },
      },
      data: { status: MediaStatus.DELETING },
    });
    if (claim.count !== 1)
      throw new InvalidStateTransitionException({
        resource: 'media asset',
        from: media.status,
        to: MediaStatus.DELETING,
      });
    await this.deleteClaimed(media);
  }

  async cleanupExpiredUploadIntents(
    options: { batchSize?: number; olderThan?: Date } = {},
  ): Promise<CleanupSummary> {
    const batchSize = Math.min(Math.max(options.batchSize ?? 100, 1), 500);
    const olderThan = options.olderThan ?? new Date();
    const candidates = await this.prisma.mediaAsset.findMany({
      where: {
        uploadExpiresAt: { lt: olderThan },
        status: {
          in: [
            MediaStatus.PENDING,
            MediaStatus.PROCESSING,
            MediaStatus.FAILED,
            MediaStatus.DELETE_FAILED,
          ],
        },
      },
      orderBy: { uploadExpiresAt: 'asc' },
      take: batchSize,
    });
    const summary: CleanupSummary = {
      scanned: candidates.length,
      deleted: 0,
      failed: 0,
      skipped: 0,
    };
    for (const media of candidates) {
      const claim = await this.prisma.mediaAsset.updateMany({
        where: { id: media.id, status: media.status },
        data: { status: MediaStatus.DELETING },
      });
      if (claim.count !== 1) {
        summary.skipped++;
        continue;
      }
      try {
        await this.deleteClaimed(media);
        summary.deleted++;
      } catch {
        summary.failed++;
      }
    }
    return summary;
  }

  private async deleteClaimed(media: MediaAsset): Promise<void> {
    try {
      if (media.publicId && media.resourceType)
        await this.mediaStorage.delete({
          publicId: media.publicId,
          resourceType: toStorageResourceType(media.resourceType),
          invalidate: true,
        });
      await this.prisma.mediaAsset.updateMany({
        where: { id: media.id, status: MediaStatus.DELETING },
        data: { status: MediaStatus.DELETED, deletedAt: new Date() },
      });
      this.logger.log({
        message: 'media delete succeeded',
        mediaAssetId: media.id,
        operation: 'delete',
      });
    } catch (error: unknown) {
      await this.prisma.mediaAsset.updateMany({
        where: { id: media.id, status: MediaStatus.DELETING },
        data: {
          status: MediaStatus.DELETE_FAILED,
          metadata: mergeMetadata(media.metadata, {
            providerOperation: 'delete',
            errorCode: MEDIA_ERROR_CODES.DELETE_FAILED,
            deleteFailureAt: new Date().toISOString(),
          }),
        },
      });
      this.logger.error({
        message: 'media delete failed',
        mediaAssetId: media.id,
        operation: 'delete',
        retryable: true,
      });
      throw error;
    }
  }
}

function toStorageResourceType(
  value: MediaResourceType,
): MediaStorageResourceType {
  const map: Record<MediaResourceType, MediaStorageResourceType> = {
    IMAGE: 'image',
    VIDEO: 'video',
    RAW: 'raw',
  };
  return map[value];
}

function mergeMetadata(
  existing: Prisma.JsonValue | null,
  extra: Record<string, string>,
): Prisma.InputJsonObject {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? existing
      : {};
  return { ...base, ...extra };
}
