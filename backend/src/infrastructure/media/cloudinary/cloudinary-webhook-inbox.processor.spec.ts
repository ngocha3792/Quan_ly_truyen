/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { MediaStatus } from '@/generated/prisma/client';
import { CloudinaryWebhookInboxProcessor } from './cloudinary-webhook-inbox.processor';

describe('CloudinaryWebhookInboxProcessor', () => {
  const prisma = {
    inboundWebhookEvent: { findMany: jest.fn(), updateMany: jest.fn() },
    mediaAsset: { updateMany: jest.fn() },
  };
  const processor = new CloudinaryWebhookInboxProcessor(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('claims and processes an upload event once', async () => {
    prisma.inboundWebhookEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        eventKey: 'key-1',
        eventType: 'upload',
        payload: { public_id: 'asset-1' },
      },
    ]);
    prisma.inboundWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });

    await expect(processor.processBatch()).resolves.toEqual({
      scanned: 1,
      processed: 1,
      failed: 0,
      skipped: 0,
    });
    expect(prisma.mediaAsset.updateMany).toHaveBeenCalledWith({
      where: { publicId: 'asset-1', status: MediaStatus.PENDING },
      data: { status: MediaStatus.UPLOADED, uploadedAt: expect.any(Date) },
    });
  });

  it('skips an event already claimed by another worker', async () => {
    prisma.inboundWebhookEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        eventKey: 'key-1',
        eventType: 'upload',
        payload: { public_id: 'asset-1' },
      },
    ]);
    prisma.inboundWebhookEvent.updateMany.mockResolvedValue({ count: 0 });
    await expect(processor.processBatch()).resolves.toEqual({
      scanned: 1,
      processed: 0,
      failed: 0,
      skipped: 1,
    });
    expect(prisma.mediaAsset.updateMany).not.toHaveBeenCalled();
  });

  it('returns retryable events to pending after processing failure', async () => {
    prisma.inboundWebhookEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        eventKey: 'key-1',
        eventType: 'delete',
        payload: { public_id: 'asset-1' },
      },
    ]);
    prisma.inboundWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.mediaAsset.updateMany.mockRejectedValue(
      new Error('temporary database failure'),
    );
    await expect(processor.processBatch()).resolves.toEqual({
      scanned: 1,
      processed: 0,
      failed: 1,
      skipped: 0,
    });
    expect(prisma.inboundWebhookEvent.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending',
          lastError: 'temporary database failure',
        }),
      }),
    );
  });
});
