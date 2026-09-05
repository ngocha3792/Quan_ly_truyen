import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@/generated/prisma/client';
import { CloudinaryWebhookAdapter } from './cloudinary-webhook.adapter';

const API_SECRET = 'test-secret';

function sign(body: Buffer, timestamp: string): string {
  return createHash('sha1')
    .update(`${body.toString('utf8')}${timestamp}${API_SECRET}`)
    .digest('hex');
}

describe('CloudinaryWebhookAdapter', () => {
  const cloudinary = {
    utils: { verifyNotificationSignature: jest.fn() },
  };
  const prisma = { inboundWebhookEvent: { create: jest.fn() } };
  const service = new CloudinaryWebhookAdapter(
    cloudinary as never,
    new ConfigService({
      cloudinary: {
        enabled: true,
        webhookSignatureTtlSeconds: 300,
        apiSecret: API_SECRET,
      },
    }),
    prisma as never,
    { recordWebhook: jest.fn() } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.inboundWebhookEvent.create.mockResolvedValue({});
  });

  it('uses a deterministic non-empty hash when the provider key is blank', async () => {
    const rawBody = Buffer.from(
      JSON.stringify({ notification_id: '  ', notification_type: 'ping' }),
    );
    const timestamp = String(Math.floor(Date.now() / 1000));
    const result = await service.handle({
      rawBody,
      timestamp,
      signature: sign(rawBody, timestamp),
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
    const rawBody = Buffer.from(
      JSON.stringify({ notification_type: 'upload' }),
    );
    const timestamp = String(Math.floor(Date.now() / 1000));
    await expect(
      service.handle({
        rawBody,
        timestamp,
        signature: sign(rawBody, timestamp),
      }),
    ).rejects.toBeDefined();
    expect(prisma.inboundWebhookEvent.create).not.toHaveBeenCalled();
  });

  it('rejects stale timestamps before persistence', async () => {
    const rawBody = Buffer.from(JSON.stringify({ notification_type: 'ping' }));
    await expect(
      service.handle({
        rawBody,
        timestamp: '1',
        signature: sign(rawBody, '1'),
      }),
    ).rejects.toBeDefined();
    expect(prisma.inboundWebhookEvent.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid provider signature', async () => {
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
    const rawBody = Buffer.from('{invalid');
    const timestamp = String(Math.floor(Date.now() / 1000));
    await expect(
      service.handle({
        rawBody,
        timestamp,
        signature: sign(rawBody, timestamp),
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
    const rawBody = Buffer.from(
      JSON.stringify({
        notification_id: 'same',
        notification_type: 'ping',
      }),
    );
    const timestamp = String(Math.floor(Date.now() / 1000));
    await expect(
      service.handle({
        rawBody,
        timestamp,
        signature: sign(rawBody, timestamp),
      }),
    ).resolves.toEqual({ duplicate: true, eventKey: 'same' });
  });
});
