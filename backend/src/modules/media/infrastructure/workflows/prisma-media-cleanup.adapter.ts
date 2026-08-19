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
  ResourceConflictException,
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
} from '../../application/ports/media-storage.port';

import type { MediaStorageResourceType } from '../../application/ports/stored-media.interface';

import { MEDIA_ERROR_CODES } from '../../domain/exceptions/media-error-codes';

import { PrismaMediaOwnershipAdapter } from '../persistence/prisma-media-ownership.adapter';

/**
 * Tất cả relation hiện tại có thể giữ một MediaAsset sống.
 *
 * Đây là source of truth.
 *
 * Khi thêm domain relation mới với MediaAsset,
 * bắt buộc thêm reverse relation vào đây.
 */
const UNREFERENCED_MEDIA_WHERE = {
  avatarOfUsers: {
    none: {},
  },

  authorApplicationSamples: {
    none: {},
  },

  bannerOfAuthors: {
    none: {},
  },

  coverOfStories: {
    none: {},
  },

  coverOfCategories: {
    none: {},
  },

  chapterLinks: {
    none: {},
  },
} satisfies Prisma.MediaAssetWhereInput;

const REFERENCED_MEDIA_WHERE = {
  OR: [
    {
      avatarOfUsers: {
        some: {},
      },
    },

    {
      authorApplicationSamples: {
        some: {},
      },
    },

    {
      bannerOfAuthors: {
        some: {},
      },
    },

    {
      coverOfStories: {
        some: {},
      },
    },

    {
      coverOfCategories: {
        some: {},
      },
    },

    {
      chapterLinks: {
        some: {},
      },
    },
  ],
} satisfies Prisma.MediaAssetWhereInput;

import type {
  CleanupSummary,
  MediaCleanupOptions,
} from '../../application/dto';
import type { MediaCleanupPort } from '../../application/ports';

@Injectable()
export class PrismaMediaCleanupAdapter implements MediaCleanupPort {
  private readonly logger = new Logger(PrismaMediaCleanupAdapter.name);

  constructor(
    private readonly prisma: PrismaService,

    @Inject(MEDIA_STORAGE)
    private readonly mediaStorage: MediaStoragePort,

    private readonly ownership: PrismaMediaOwnershipAdapter,

    private readonly configService: ConfigService,

    private readonly metrics: MetricsService,

    private readonly tracing: TracingService,
  ) {}

  async deleteById(
    mediaId: string,

    principal?: AuthPrincipal,
  ): Promise<void> {
    const media = await this.prisma.mediaAsset.findUnique({
      where: {
        id: mediaId,
      },
    });

    if (!media) {
      throw new ResourceNotFoundException({
        resource: 'media asset',

        identifier: mediaId,
      });
    }

    if (principal) {
      this.ownership.assertCanDelete(
        principal,

        media.uploaderId,
      );
    }

    if (media.status === MediaStatus.DELETED) {
      return;
    }

    /**
     * Claim và reference check nằm cùng một SQL UPDATE.
     *
     * Nếu asset đang được domain sử dụng,
     * count === 0.
     *
     * Quan trọng:
     * không chỉ check reference trước rồi update sau,
     * vì giữa hai statement có thể phát sinh race.
     */
    const claim = await this.prisma.mediaAsset.updateMany({
      where: {
        id: mediaId,

        status: {
          in: [MediaStatus.READY, MediaStatus.DELETE_FAILED],
        },

        ...UNREFERENCED_MEDIA_WHERE,
      },

      data: {
        status: MediaStatus.DELETING,

        deleteAttempts: {
          increment: 1,
        },

        processingStartedAt: new Date(),

        nextDeleteAttemptAt: null,
      },
    });

    if (claim.count !== 1) {
      const referenced = await this.hasDomainReference(mediaId);

      if (referenced) {
        throw new ResourceConflictException({
          code: MEDIA_ERROR_CODES.ASSET_IN_USE,

          message: ['Media đang được sử dụng', 'và không thể xóa.'].join(' '),

          resource: 'media asset',

          value: mediaId,
        });
      }

      const current = await this.prisma.mediaAsset.findUnique({
        where: {
          id: mediaId,
        },

        select: {
          status: true,
        },
      });

      /**
       * Concurrent delete đã hoàn thành.
       */
      if (current?.status === MediaStatus.DELETED) {
        return;
      }

      throw new InvalidStateTransitionException({
        resource: 'media asset',

        from: current?.status ?? media.status,

        to: MediaStatus.DELETING,
      });
    }

    await this.deleteClaimed(
      media,

      media.deleteAttempts + 1,
    );
  }

  /**
   * API cleanup mới.
   *
   * Bao gồm:
   *
   * - expired upload intents
   * - failed delete retries
   * - stale deleting claims
   * - READY orphan assets
   */
  async cleanupStaleMedia(
    options: MediaCleanupOptions = {},
  ): Promise<CleanupSummary> {
    return this.tracing.inSpan(
      MANUAL_SPANS.MEDIA_CLEANUP,

      {
        'media.provider': 'cloudinary',
      },

      () => this.cleanupStaleMediaInternal(options),
    );
  }

  /**
   * Compatibility alias.
   *
   * Giữ để code/test/job cũ không vỡ ngay.
   *
   * Có thể xóa ở refactor sau.
   */
  async cleanupExpiredUploadIntents(
    options: MediaCleanupOptions = {},
  ): Promise<CleanupSummary> {
    return this.cleanupStaleMedia(options);
  }

  private async cleanupStaleMediaInternal(
    options: MediaCleanupOptions,
  ): Promise<CleanupSummary> {
    const batchSize = Math.min(
      Math.max(
        options.batchSize ?? 100,

        1,
      ),

      500,
    );

    const olderThan = options.olderThan ?? new Date();

    const staleProcessingBefore = new Date(olderThan.getTime() - 5 * 60_000);

    const readyOrphanGraceSeconds = this.configService.get<number>(
      'cloudinary.readyOrphanGraceSeconds',

      3600,
    );

    const readyOrphanBefore = new Date(
      olderThan.getTime() - readyOrphanGraceSeconds * 1000,
    );

    const maxAttempts = this.configService.get<number>(
      'cloudinary.deleteMaxAttempts',

      5,
    );

    const candidates = await this.prisma.mediaAsset.findMany({
      where: {
        deleteAttempts: {
          lt: maxAttempts,
        },

        OR: [
          /**
           * Upload intent không được confirm.
           */
          {
            uploadExpiresAt: {
              lt: olderThan,
            },

            status: {
              in: [
                MediaStatus.PENDING,

                MediaStatus.UPLOADED,

                MediaStatus.PROCESSING,

                MediaStatus.FAILED,
              ],
            },
          },

          /**
           * Asset đã confirm READY nhưng chưa bao giờ
           * được domain entity attach.
           *
           * Ví dụ:
           *
           * Avatar:
           * confirm -> PATCH profile fail.
           *
           * Author sample:
           * confirm -> submit fail.
           */
          {
            status: MediaStatus.READY,

            ...UNREFERENCED_MEDIA_WHERE,

            OR: [
              {
                readyAt: {
                  lt: readyOrphanBefore,
                },
              },

              /**
               * Fallback cho legacy READY record
               * không có readyAt.
               */
              {
                readyAt: null,

                updatedAt: {
                  lt: readyOrphanBefore,
                },
              },
            ],
          },

          /**
           * Retry provider delete.
           *
           * Nếu asset somehow được domain attach lại,
           * không retry delete.
           */
          {
            status: MediaStatus.DELETE_FAILED,

            ...UNREFERENCED_MEDIA_WHERE,

            OR: [
              {
                nextDeleteAttemptAt: null,
              },

              {
                nextDeleteAttemptAt: {
                  lte: olderThan,
                },
              },
            ],
          },

          /**
           * Worker/process chết sau khi claim DELETING.
           */
          {
            status: MediaStatus.DELETING,

            ...UNREFERENCED_MEDIA_WHERE,

            processingStartedAt: {
              lt: staleProcessingBefore,
            },
          },
        ],
      },

      orderBy: {
        updatedAt: 'asc',
      },

      take: batchSize,
    });

    const summary: CleanupSummary = {
      scanned: candidates.length,

      deleted: 0,

      failed: 0,

      skipped: 0,
    };

    for (const media of candidates) {
      /**
       * Atomic-ish claim:
       *
       * Candidate có thể unreferenced lúc scan,
       * nhưng được attach trước claim.
       *
       * Relation predicates được check lại
       * trong UPDATE này.
       */
      const claim = await this.prisma.mediaAsset.updateMany({
        where: {
          id: media.id,

          status: media.status,

          deleteAttempts: media.deleteAttempts,

          ...UNREFERENCED_MEDIA_WHERE,
        },

        data: {
          status: MediaStatus.DELETING,

          deleteAttempts: {
            increment: 1,
          },

          processingStartedAt: new Date(),

          nextDeleteAttemptAt: null,
        },
      });

      if (claim.count !== 1) {
        summary.skipped++;

        continue;
      }

      try {
        await this.deleteClaimed(
          media,

          media.deleteAttempts + 1,
        );

        summary.deleted++;
      } catch {
        summary.failed++;
      }
    }

    for (let index = 0; index < summary.deleted; index++) {
      this.metrics.recordMediaCleanup('success');
    }

    for (let index = 0; index < summary.failed; index++) {
      this.metrics.recordMediaCleanup('failed');
    }

    for (let index = 0; index < summary.skipped; index++) {
      this.metrics.recordMediaCleanup('skipped');
    }

    return summary;
  }

  private async hasDomainReference(mediaId: string): Promise<boolean> {
    const referenced = await this.prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,

        ...REFERENCED_MEDIA_WHERE,
      },

      select: {
        id: true,
      },
    });

    return Boolean(referenced);
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
        where: {
          id: media.id,

          status: MediaStatus.DELETING,
        },

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
        Date.now() +
          retryBaseMs *
            2 **
              Math.max(
                attempt - 1,

                0,
              ),
      );

      const providerErrorCode =
        error instanceof StorageException
          ? String(error.code)
          : MEDIA_ERROR_CODES.DELETE_FAILED;

      await this.prisma.mediaAsset.updateMany({
        where: {
          id: media.id,

          status: MediaStatus.DELETING,
        },

        data: {
          status: MediaStatus.DELETE_FAILED,

          processingStartedAt: null,

          nextDeleteAttemptAt,

          lastProviderErrorCode: providerErrorCode,

          metadata: mergeMetadata(
            media.metadata,

            {
              providerOperation: 'delete',

              errorCode: MEDIA_ERROR_CODES.DELETE_FAILED,

              deleteFailureAt: new Date().toISOString(),
            },
          ),
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
      if (resourceType === expectedType) {
        continue;
      }

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

  return {
    ...base,

    ...extra,
  };
}
