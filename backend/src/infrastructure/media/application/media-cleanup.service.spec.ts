import { ConfigService } from '@nestjs/config';
import { MediaResourceType, MediaStatus } from '@/generated/prisma/client';
import { MediaCleanupService } from './media-cleanup.service';

describe('MediaCleanupService', () => {
  const prisma = {
    mediaAsset: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const storage = { delete: jest.fn() };
  const ownership = { assertCanDelete: jest.fn() };
  const service = new MediaCleanupService(
    prisma as never,
    storage as never,
    ownership as never,
    new ConfigService({
      cloudinary: { deleteMaxAttempts: 5, deleteRetryBaseMs: 100 },
    }),
    { recordMediaCleanup: jest.fn() } as never,
    {
      inSpan: jest.fn(
        (_name: string, _attributes: object, work: () => unknown) => work(),
      ),
    } as never,
  );

  beforeEach(() => jest.clearAllMocks());

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
    prisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });
    storage.delete
      .mockResolvedValueOnce({ outcome: 'not_found' })
      .mockResolvedValueOnce({ outcome: 'not_found' })
      .mockResolvedValueOnce({ outcome: 'deleted' });

    await expect(service.cleanupExpiredUploadIntents()).resolves.toMatchObject({
      deleted: 1,
      failed: 0,
    });
    expect(storage.delete).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ publicId: 'asset-id', resourceType: 'raw' }),
    );
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
    prisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });
    storage.delete.mockResolvedValue({ outcome: 'deleted' });
    await service.deleteById(media.id, {
      userId: '00000000-0000-4000-8000-000000000003',
      sessionId: '00000000-0000-4000-8000-000000000004',
      emailVerified: true,
      roles: [],
      permissions: [],
    });
    expect(ownership.assertCanDelete).toHaveBeenCalled();
  });
});
