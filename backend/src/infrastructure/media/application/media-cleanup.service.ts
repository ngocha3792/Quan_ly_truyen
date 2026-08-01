import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MediaAsset,
  MediaResourceType,
  MediaStatus,
  Prisma,
} from '@/generated/prisma/client';
import {
  InvalidStateTransitionException,
  ResourceNotFoundException,
  StorageException,
} from '@/common/exceptions';
import type { AuthPrincipal } from '@/common/interfaces/auth';
import { PrismaService } from '@/infrastructure/database/prisma';
import {
  MANUAL_SPANS,
  MetricsService,
  TracingService,
} from '@/infrastructure/observability';
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
    private readonly configService: ConfigService,
    private readonly metrics: MetricsService,
    private readonly tracing: TracingService,
  ) {}

  async deleteById(mediaId: string, principal?: AuthPrincipal): Promise<void> {
    const media = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaId },
    });
    if (!media)
      throw new ResourceNotFoundException({
        resource: 'media asset',
        identifier: mediaId,
      });
    if (principal) this.ownership.assertCanDelete(principal, media.uploaderId);
    if (media.status === MediaStatus.DELETED) return;
    const claim = await this.prisma.mediaAsset.updateMany({
      where: {
        id: mediaId,
        status: { in: [MediaStatus.READY, MediaStatus.DELETE_FAILED] },
      },
      data: {
        status: MediaStatus.DELETING,
        deleteAttempts: { increment: 1 },
        processingStartedAt: new Date(),
        nextDeleteAttemptAt: null,
      },
    });
    if (claim.count !== 1)
      throw new InvalidStateTransitionException({
        resource: 'media asset',
        from: media.status,
        to: MediaStatus.DELETING,
      });
    await this.deleteClaimed(media, media.deleteAttempts + 1);
  }

  async cleanupExpiredUploadIntents(
    options: { batchSize?: number; olderThan?: Date } = {},
  ): Promise<CleanupSummary> {
    return this.tracing.inSpan(
      MANUAL_SPANS.MEDIA_CLEANUP,
      { 'media.provider': 'cloudinary' },
      () => this.cleanupExpiredUploadIntentsInternal(options),
    );
  }

  private async cleanupExpiredUploadIntentsInternal(options: {
    batchSize?: number;
    olderThan?: Date;
  }): Promise<CleanupSummary> {
    const batchSize = Math.min(Math.max(options.batchSize ?? 100, 1), 500);
    const olderThan = options.olderThan ?? new Date();
    const staleProcessingBefore = new Date(olderThan.getTime() - 5 * 60_000);
    const maxAttempts = this.configService.get<number>(
      'cloudinary.deleteMaxAttempts',
      5,
    );
    const candidates = await this.prisma.mediaAsset.findMany({
      where: {
        deleteAttempts: { lt: maxAttempts },
        OR: [
          {
            uploadExpiresAt: { lt: olderThan },
            status: {
              in: [
                MediaStatus.PENDING,
                MediaStatus.UPLOADED,
                MediaStatus.PROCESSING,
                MediaStatus.FAILED,
              ],
            },
          },
          {
            status: MediaStatus.DELETE_FAILED,
            OR: [
              { nextDeleteAttemptAt: null },
              { nextDeleteAttemptAt: { lte: olderThan } },
            ],
          },
          {
            status: MediaStatus.DELETING,
            processingStartedAt: { lt: staleProcessingBefore },
          },
        ],
      },
      orderBy: { updatedAt: 'asc' },
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
        where: {
          id: media.id,
          status: media.status,
          deleteAttempts: media.deleteAttempts,
        },
        data: {
          status: MediaStatus.DELETING,
          deleteAttempts: { increment: 1 },
          processingStartedAt: new Date(),
          nextDeleteAttemptAt: null,
        },
      });
      if (claim.count !== 1) {
        summary.skipped++;
        continue;
      }
      try {
        await this.deleteClaimed(media, media.deleteAttempts + 1);
        summary.deleted++;
      } catch {
        summary.failed++;
      }
    }
    for (let index = 0; index < summary.deleted; index++)
      this.metrics.recordMediaCleanup('success');
    for (let index = 0; index < summary.failed; index++)
      this.metrics.recordMediaCleanup('failed');
    for (let index = 0; index < summary.skipped; index++)
      this.metrics.recordMediaCleanup('skipped');
    return summary;
  }

  private async deleteClaimed(
    media: MediaAsset,
    attempt: number,
  ): Promise<void> {
    try {
      if (media.publicId && media.resourceType) {
        const expectedType = toStorageResourceType(media.resourceType);
        const result = await this.mediaStorage.delete({
          publicId: media.publicId,
          resourceType: expectedType,
          invalidate: true,
        });
        if (
          result.outcome === 'not_found' &&
          media.status !== MediaStatus.READY
        ) {
          await this.deleteAcrossAlternateResourceTypes(
            media.id,
            media.publicId,
            expectedType,
          );
        }
      }
      await this.prisma.mediaAsset.updateMany({
        where: { id: media.id, status: MediaStatus.DELETING },
        data: {
          status: MediaStatus.DELETED,
          deletedAt: new Date(),
          processingStartedAt: null,
          nextDeleteAttemptAt: null,
          lastProviderErrorCode: null,
        },
      });
      this.logger.log({
        message: 'media delete succeeded',
        mediaAssetId: media.id,
        operation: 'delete',
      });
    } catch (error: unknown) {
      const retryBaseMs = this.configService.get<number>(
        'cloudinary.deleteRetryBaseMs',
        5000,
      );
      const nextDeleteAttemptAt = new Date(
        Date.now() + retryBaseMs * 2 ** Math.max(attempt - 1, 0),
      );
      const providerErrorCode =
        error instanceof StorageException
          ? String(error.code)
          : MEDIA_ERROR_CODES.DELETE_FAILED;
      await this.prisma.mediaAsset.updateMany({
        where: { id: media.id, status: MediaStatus.DELETING },
        data: {
          status: MediaStatus.DELETE_FAILED,
          processingStartedAt: null,
          nextDeleteAttemptAt,
          lastProviderErrorCode: providerErrorCode,
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

  private async deleteAcrossAlternateResourceTypes(
    mediaAssetId: string,
    publicId: string,
    expectedType: MediaStorageResourceType,
  ): Promise<void> {
    for (const resourceType of ['image', 'video', 'raw'] as const) {
      if (resourceType === expectedType) continue;
      const result = await this.mediaStorage.delete({
        publicId,
        resourceType,
        invalidate: true,
      });
      if (result.outcome === 'deleted') {
        this.logger.warn({
          message: 'media cleanup used resource type fallback',
          mediaAssetId,
          operation: 'delete',
          resourceType,
        });
        return;
      }
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
