/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';
import { MediaPurpose, MediaStatus } from '@/generated/prisma/client';
import { PermissionCode, RoleCode } from '@/common/enums';
import { MediaService } from './media.service';
import { MediaPublicIdService } from '../policies/media-public-id.service';

describe('MediaService upload intent', () => {
  const principal = {
    userId: '00000000-0000-4000-8000-000000000001',
    sessionId: '00000000-0000-4000-8000-000000000011',
    emailVerified: true,
    roles: [RoleCode.USER],
    permissions: [PermissionCode.MEDIA_UPLOAD],
  };
  const prisma = { mediaAsset: { create: jest.fn(), delete: jest.fn() } };
  const storage = { createSignedUpload: jest.fn() };
  const ownership = { assertCanCreate: jest.fn(), assertUploader: jest.fn() };
  const service = new MediaService(
    prisma as never,
    storage as never,
    new ConfigService({
      cloudinary: { rootFolder: 'root', uploadIntentTtlSeconds: 300 },
    }),
    new MediaPublicIdService(),
    ownership as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('persists expected raw identity before signing', async () => {
    prisma.mediaAsset.create.mockResolvedValue({});
    storage.createSignedUpload.mockImplementation((input: unknown) => input);
    const result = await service.createUploadIntent({
      principal,
      ownerId: '00000000-0000-4000-8000-000000000002',
      purpose: MediaPurpose.ATTACHMENT,
      originalName: 'file.PDF',
      declaredMimeType: 'application/pdf',
      declaredSizeBytes: 100,
    });
    expect(prisma.mediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: MediaStatus.PENDING,
          publicId: expect.stringMatching(/\.pdf$/),
          resourceType: 'RAW',
          assetFolder: expect.stringContaining('/attachments/'),
        }),
      }),
    );
    expect(result).toMatchObject({
      publicId: expect.stringMatching(/\.pdf$/),
      resourceType: 'raw',
    });
  });

  it.each([
    {
      originalName: 'file.pdf',
      declaredMimeType: 'application/zip',
      declaredSizeBytes: 10,
    },
    {
      originalName: '../file.pdf',
      declaredMimeType: 'application/pdf',
      declaredSizeBytes: 10,
    },
    {
      originalName: 'file.pdf',
      declaredMimeType: 'application/pdf',
      declaredSizeBytes: 0,
    },
  ])('rejects invalid declaration before DB insert', async (input) => {
    await expect(
      service.createUploadIntent({
        principal,
        ownerId: 'o',
        purpose: MediaPurpose.ATTACHMENT,
        ...input,
      }),
    ).rejects.toBeDefined();
    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
  });
});
