import { ConfigService } from '@nestjs/config';

import { MediaResourceType, MediaStatus } from '@/generated/prisma/client';

import { MEDIA_ERROR_CODES } from './errors/media-error-codes';

import { MediaCleanupService } from './media-cleanup.service';

describe('MediaCleanupService', () => {
  const prisma = {
    mediaAsset: {
      findMany: jest.fn(),

      findUnique: jest.fn(),

      findFirst: jest.fn(),

      updateMany: jest.fn(),
    },
  };

  const storage = {
    delete: jest.fn(),
  };

  const ownership = {
    assertCanDelete: jest.fn(),
  };

  const metrics = {
    recordMediaCleanup: jest.fn(),
  };

  const tracing = {
    inSpan: jest.fn(
      (
        _name: string,

        _attributes: object,

        work: () => unknown,
      ) => work(),
    ),
  };

  const service = new MediaCleanupService(
    prisma as never,

    storage as never,

    ownership as never,

    new ConfigService({
      cloudinary: {
        deleteMaxAttempts: 5,

        deleteRetryBaseMs: 100,

        readyOrphanGraceSeconds: 3600,
      },
    }),

    metrics as never,

    tracing as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes an unconfirmed raw orphan after the expected image is absent', async () => {
    const media = {
      id: '00000000-0000-4000-8000-000000000001',

      status: MediaStatus.PENDING,

      publicId: 'asset-id',

      resourceType: MediaResourceType.IMAGE,

      deleteAttempts: 0,

      metadata: null,
    };

    prisma.mediaAsset.findMany.mockResolvedValue([media]);

    prisma.mediaAsset.updateMany.mockResolvedValue({
      count: 1,
    });

    storage.delete
      .mockResolvedValueOnce({
        outcome: 'not_found',
      })
      .mockResolvedValueOnce({
        outcome: 'not_found',
      })
      .mockResolvedValueOnce({
        outcome: 'deleted',
      });

    await expect(service.cleanupStaleMedia()).resolves.toMatchObject({
      deleted: 1,

      failed: 0,
    });

    expect(storage.delete).toHaveBeenNthCalledWith(
      3,

      expect.objectContaining({
        publicId: 'asset-id',

        resourceType: 'raw',
      }),
    );
  });

  it('cleanup được READY orphan quá grace period', async () => {
    const media = {
      id: '00000000-0000-4000-8000-000000000010',

      status: MediaStatus.READY,

      publicId: 'ready-orphan',

      resourceType: MediaResourceType.IMAGE,

      deleteAttempts: 0,

      metadata: null,

      readyAt: new Date('2026-08-08T00:00:00.000Z'),

      updatedAt: new Date('2026-08-08T00:00:00.000Z'),
    };

    prisma.mediaAsset.findMany.mockResolvedValue([media]);

    prisma.mediaAsset.updateMany.mockResolvedValue({
      count: 1,
    });

    storage.delete.mockResolvedValue({
      outcome: 'deleted',
    });

    const summary = await service.cleanupStaleMedia({
      olderThan: new Date('2026-08-08T02:00:00.000Z'),
    });

    expect(summary).toMatchObject({
      scanned: 1,

      deleted: 1,

      failed: 0,

      skipped: 0,
    });

    expect(storage.delete).toHaveBeenCalledWith({
      publicId: 'ready-orphan',

      resourceType: 'image',

      invalidate: true,
    });
  });

  it('skip READY orphan nếu asset được attach giữa scan và claim', async () => {
    const media = {
      id: '00000000-0000-4000-8000-000000000011',

      status: MediaStatus.READY,

      publicId: 'attached-during-cleanup',

      resourceType: MediaResourceType.IMAGE,

      deleteAttempts: 0,

      metadata: null,

      readyAt: new Date('2026-08-08T00:00:00.000Z'),

      updatedAt: new Date('2026-08-08T00:00:00.000Z'),
    };

    prisma.mediaAsset.findMany.mockResolvedValue([media]);

    /**
     * Relation xuất hiện trước atomic claim.
     *
     * WHERE avatarOfUsers none / etc
     * không còn match.
     */
    prisma.mediaAsset.updateMany.mockResolvedValue({
      count: 0,
    });

    const summary = await service.cleanupStaleMedia({
      olderThan: new Date('2026-08-08T02:00:00.000Z'),
    });

    expect(summary).toEqual({
      scanned: 1,

      deleted: 0,

      failed: 0,

      skipped: 1,
    });

    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('không cho explicit delete media đang được domain sử dụng', async () => {
    const media = {
      id: '00000000-0000-4000-8000-000000000020',

      uploaderId: '00000000-0000-4000-8000-000000000021',

      status: MediaStatus.READY,

      publicId: 'current-avatar',

      resourceType: MediaResourceType.IMAGE,

      deleteAttempts: 0,

      metadata: null,
    };

    prisma.mediaAsset.findUnique.mockResolvedValue(media);

    /**
     * Atomic delete claim fail vì relation exists.
     */
    prisma.mediaAsset.updateMany.mockResolvedValue({
      count: 0,
    });

    prisma.mediaAsset.findFirst.mockResolvedValue({
      id: media.id,
    });

    await expect(service.deleteById(media.id)).rejects.toMatchObject({
      code: MEDIA_ERROR_CODES.ASSET_IN_USE,
    });

    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('vẫn cho explicit delete READY media không còn reference', async () => {
    const media = {
      id: '00000000-0000-4000-8000-000000000030',

      uploaderId: '00000000-0000-4000-8000-000000000031',

      status: MediaStatus.READY,

      publicId: 'unused-avatar',

      resourceType: MediaResourceType.IMAGE,

      deleteAttempts: 0,

      metadata: null,
    };

    prisma.mediaAsset.findUnique.mockResolvedValue(media);

    prisma.mediaAsset.updateMany.mockResolvedValue({
      count: 1,
    });

    storage.delete.mockResolvedValue({
      outcome: 'deleted',
    });

    await expect(service.deleteById(media.id)).resolves.toBeUndefined();

    expect(storage.delete).toHaveBeenCalledWith({
      publicId: 'unused-avatar',

      resourceType: 'image',

      invalidate: true,
    });
  });

  it('allows explicit media.manage.any permission without an admin role bypass', async () => {
    const media = {
      id: '00000000-0000-4000-8000-000000000001',

      uploaderId: '00000000-0000-4000-8000-000000000002',

      status: MediaStatus.READY,

      publicId: 'asset-id',

      resourceType: MediaResourceType.IMAGE,

      deleteAttempts: 0,

      metadata: null,
    };

    prisma.mediaAsset.findUnique.mockResolvedValue(media);

    prisma.mediaAsset.updateMany.mockResolvedValue({
      count: 1,
    });

    storage.delete.mockResolvedValue({
      outcome: 'deleted',
    });

    await service.deleteById(
      media.id,

      {
        userId: '00000000-0000-4000-8000-000000000003',

        sessionId: '00000000-0000-4000-8000-000000000004',

        emailVerified: true,

        roles: [],

        permissions: [],
      },
    );

    expect(ownership.assertCanDelete).toHaveBeenCalled();
  });
});
