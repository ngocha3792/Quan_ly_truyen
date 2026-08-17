import { ConfigService } from '@nestjs/config';
import { Prisma } from '@/generated/prisma/client';
import { CloudinaryWebhookService } from './cloudinary-webhook.service';

describe('CloudinaryWebhookService', () => {
  const cloudinary = {
    utils: { verifyNotificationSignature: jest.fn() },
  };
  const prisma = { inboundWebhookEvent: { create: jest.fn() } };
  const service = new CloudinaryWebhookService(
    cloudinary as never,
    new ConfigService({
      cloudinary: { enabled: true, webhookSignatureTtlSeconds: 300 },
    }),
    prisma as never,
    { recordWebhook: jest.fn() } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    cloudinary.utils.verifyNotificationSignature.mockReturnValue(true);
    prisma.inboundWebhookEvent.create.mockResolvedValue({});
  });

  it('uses a deterministic non-empty hash when the provider key is blank', async () => {
    const rawBody = Buffer.from(
      JSON.stringify({ notification_id: '  ', notification_type: 'ping' }),
    );
    const result = await service.handle({
      rawBody,
      timestamp: String(Math.floor(Date.now() / 1000)),
      signature: 'valid',
    });
    expect(result.eventKey).toMatch(/^[a-f0-9]{64}$/);
    const persistedCalls = prisma.inboundWebhookEvent.create.mock
      .calls as unknown as Array<[unknown]>;
    const persistedInput = persistedCalls[0]?.[0];
    expect(persistedInput).toMatchObject({
      data: { eventKey: result.eventKey },
    });
  });

  it('rejects a supported asset event without authoritative identity fields', async () => {
    await expect(
      service.handle({
        rawBody: Buffer.from(JSON.stringify({ notification_type: 'upload' })),
        timestamp: String(Math.floor(Date.now() / 1000)),
        signature: 'valid',
      }),
    ).rejects.toBeDefined();
    expect(prisma.inboundWebhookEvent.create).not.toHaveBeenCalled();
  });

  it('rejects stale timestamps before persistence', async () => {
    await expect(
      service.handle({
        rawBody: Buffer.from(JSON.stringify({ notification_type: 'ping' })),
        timestamp: '1',
        signature: 'valid',
      }),
    ).rejects.toBeDefined();
    expect(prisma.inboundWebhookEvent.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid provider signature', async () => {
    cloudinary.utils.verifyNotificationSignature.mockReturnValue(false);
    await expect(
      service.handle({
        rawBody: Buffer.from(JSON.stringify({ notification_type: 'ping' })),
        timestamp: String(Math.floor(Date.now() / 1000)),
        signature: 'invalid',
      }),
    ).rejects.toBeDefined();
    expect(prisma.inboundWebhookEvent.create).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON before persistence', async () => {
    await expect(
      service.handle({
        rawBody: Buffer.from('{invalid'),
        timestamp: String(Math.floor(Date.now() / 1000)),
        signature: 'valid',
      }),
    ).rejects.toBeDefined();
    expect(prisma.inboundWebhookEvent.create).not.toHaveBeenCalled();
  });

  it('treats a provider/event-key unique violation as a duplicate', async () => {
    prisma.inboundWebhookEvent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate webhook', {
        code: 'P2002',
        clientVersion: '7.9.1',
        meta: { target: ['provider', 'event_key'] },
      }),
    );
    await expect(
      service.handle({
        rawBody: Buffer.from(
          JSON.stringify({
            notification_id: 'same',
            notification_type: 'ping',
          }),
        ),
        timestamp: String(Math.floor(Date.now() / 1000)),
        signature: 'valid',
      }),
    ).resolves.toEqual({ duplicate: true, eventKey: 'same' });
  });
});
