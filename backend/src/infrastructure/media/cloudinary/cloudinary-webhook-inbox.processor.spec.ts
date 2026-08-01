/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { MediaStatus } from '@/generated/prisma/client';
import {
  InboundWebhookStatus,
  MediaResourceType,
} from '@/generated/prisma/client';
import { ConfigService } from '@nestjs/config';
import { CloudinaryWebhookInboxProcessor } from './cloudinary-webhook-inbox.processor';

describe('CloudinaryWebhookInboxProcessor', () => {
  const prisma = {
    inboundWebhookEvent: { findMany: jest.fn(), updateMany: jest.fn() },
    mediaAsset: { updateMany: jest.fn() },
  };
  const processor = new CloudinaryWebhookInboxProcessor(
    prisma as never,
    new ConfigService({
      cloudinary: { webhookMaxAttempts: 3, webhookRetryBaseMs: 100 },
    }),
    { recordWebhook: jest.fn() } as never,
    {
      inSpan: jest.fn(
        (_name: string, _attributes: object, work: () => unknown) => work(),
      ),
    } as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('claims and processes an upload event once', async () => {
    prisma.inboundWebhookEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        eventKey: 'key-1',
        eventType: 'upload',
        status: InboundWebhookStatus.PENDING,
        attempts: 0,
        payload: { public_id: 'asset-1', resource_type: 'image' },
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
      where: {
        status: MediaStatus.PENDING,
        OR: [{ publicId: 'asset-1', resourceType: MediaResourceType.IMAGE }],
      },
      data: { status: MediaStatus.UPLOADED, uploadedAt: expect.any(Date) },
    });
    expect(prisma.inboundWebhookEvent.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: 'event-1',
          status: InboundWebhookStatus.PROCESSING,
          attempts: 1,
        },
      }),
    );
  });

  it('skips an event already claimed by another worker', async () => {
    prisma.inboundWebhookEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        eventKey: 'key-1',
        eventType: 'upload',
        status: InboundWebhookStatus.PENDING,
        attempts: 0,
        payload: { public_id: 'asset-1', resource_type: 'image' },
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
        status: InboundWebhookStatus.PENDING,
        attempts: 0,
        payload: { public_id: 'asset-1', resource_type: 'image' },
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
        where: {
          id: 'event-1',
          status: InboundWebhookStatus.PROCESSING,
          attempts: 1,
        },
        data: expect.objectContaining({
          status: InboundWebhookStatus.FAILED,
          lastError: 'temporary database failure',
        }),
      }),
    );
  });

  it('marks unsupported valid events as ignored', async () => {
    prisma.inboundWebhookEvent.findMany.mockResolvedValue([
      {
        id: 'event-ignored',
        eventKey: 'key-ignored',
        eventType: 'ping',
        status: InboundWebhookStatus.PENDING,
        attempts: 0,
        payload: {},
      },
    ]);
    prisma.inboundWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
    await processor.processBatch();
    expect(prisma.inboundWebhookEvent.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: InboundWebhookStatus.IGNORED }),
      }),
    );
    expect(prisma.mediaAsset.updateMany).not.toHaveBeenCalled();
  });

  it('guards delete updates against an older provider version', async () => {
    prisma.inboundWebhookEvent.findMany.mockResolvedValue([
      {
        id: 'event-delete',
        eventKey: 'key-delete',
        eventType: 'delete',
        status: InboundWebhookStatus.PENDING,
        attempts: 0,
        payload: { public_id: 'asset-1', resource_type: 'image', version: 1 },
      },
    ]);
    prisma.inboundWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.mediaAsset.updateMany.mockResolvedValue({ count: 0 });
    await processor.processBatch();
    expect(prisma.mediaAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { OR: [{ version: null }, { version: { lte: 1 } }] },
          ]),
        }),
      }),
    );
  });

  it('does not count success when a stale attempt loses finalization ownership', async () => {
    prisma.inboundWebhookEvent.findMany.mockResolvedValue([
      webhookEvent({ attempts: 0 }),
    ]);
    prisma.inboundWebhookEvent.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });

    await expect(processor.processBatch()).resolves.toEqual({
      scanned: 1,
      processed: 0,
      failed: 0,
      skipped: 1,
    });
    expect(prisma.inboundWebhookEvent.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: 'event-1',
          status: InboundWebhookStatus.PROCESSING,
          attempts: 1,
        },
      }),
    );
  });

  it('does not count failure when a stale attempt loses finalization ownership', async () => {
    prisma.inboundWebhookEvent.findMany.mockResolvedValue([
      webhookEvent({ eventType: 'delete', attempts: 1 }),
    ]);
    prisma.inboundWebhookEvent.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.mediaAsset.updateMany.mockRejectedValue(new Error('temporary'));

    await expect(processor.processBatch()).resolves.toEqual({
      scanned: 1,
      processed: 0,
      failed: 0,
      skipped: 1,
    });
    expect(prisma.inboundWebhookEvent.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: 'event-1',
          status: InboundWebhookStatus.PROCESSING,
          attempts: 2,
        },
      }),
    );
  });

  it('uses the claim time of each event while preserving attempts CAS', async () => {
    const firstClaimedAt = new Date('2026-08-02T01:00:00.000Z');
    const secondClaimedAt = new Date('2026-08-02T01:00:30.000Z');
    jest.useFakeTimers().setSystemTime(firstClaimedAt);
    try {
      prisma.inboundWebhookEvent.findMany.mockResolvedValue([
        webhookEvent({ id: 'event-1', eventKey: 'key-1', attempts: 0 }),
        webhookEvent({ id: 'event-2', eventKey: 'key-2', attempts: 2 }),
      ]);
      prisma.inboundWebhookEvent.updateMany.mockImplementation(
        (args: {
          where: { id?: string };
          data: { processingStartedAt?: Date };
        }) => {
          if (
            args.where.id === 'event-1' &&
            args.data.processingStartedAt instanceof Date
          ) {
            jest.setSystemTime(secondClaimedAt);
          }
          return Promise.resolve({ count: 1 });
        },
      );
      prisma.mediaAsset.updateMany.mockResolvedValue({ count: 1 });

      await processor.processBatch();

      const claimCalls = prisma.inboundWebhookEvent.updateMany.mock.calls
        .map(
          ([args]) =>
            args as {
              where: { id?: string; attempts?: number };
              data: { processingStartedAt?: Date };
            },
        )
        .filter(({ data }) => data.processingStartedAt instanceof Date);
      expect(claimCalls).toHaveLength(2);
      expect(claimCalls[0]).toMatchObject({
        where: { id: 'event-1', attempts: 0 },
        data: { processingStartedAt: firstClaimedAt },
      });
      expect(claimCalls[1]).toMatchObject({
        where: { id: 'event-2', attempts: 2 },
        data: { processingStartedAt: secondClaimedAt },
      });
    } finally {
      jest.useRealTimers();
    }
  });
});

function webhookEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    eventKey: 'key-1',
    eventType: 'upload',
    status: InboundWebhookStatus.PENDING,
    attempts: 0,
    payload: { public_id: 'asset-1', resource_type: 'image' },
    ...overrides,
  };
}
