import { Prisma } from '@/generated/prisma/client';

import { PrismaBillingPersistence } from './prisma-billing.persistence';

const event = {
  eventId: 'provider-event-1',
  type: 'payment.succeeded' as const,
  orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  providerReference: 'provider-reference-1',
  amountMinor: '50000',
  currency: 'VND',
  occurredAt: '2026-09-07T12:00:00.000Z',
};

describe('PrismaBillingPersistence webhook inbox', () => {
  const prisma = {
    inboundWebhookEvent: { create: jest.fn(), findUnique: jest.fn() },
  };
  const persistence = new PrismaBillingPersistence(
    prisma as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.inboundWebhookEvent.create.mockResolvedValue({});
    prisma.inboundWebhookEvent.findUnique.mockResolvedValue(null);
  });

  it('acknowledges an exact duplicate event', async () => {
    prisma.inboundWebhookEvent.create.mockRejectedValue(duplicateError());
    prisma.inboundWebhookEvent.findUnique.mockResolvedValue({
      payloadHash: 'a'.repeat(64),
    });

    await expect(
      persistence.receiveWebhookEvent({
        provider: 'hmac-sandbox',
        event,
        payloadHash: 'a'.repeat(64),
      }),
    ).resolves.toEqual({ duplicate: true });
  });

  it('rejects a reused event id carrying a different payload', async () => {
    prisma.inboundWebhookEvent.create.mockRejectedValue(duplicateError());
    prisma.inboundWebhookEvent.findUnique.mockResolvedValue({
      payloadHash: 'b'.repeat(64),
    });

    await expect(
      persistence.receiveWebhookEvent({
        provider: 'hmac-sandbox',
        event,
        payloadHash: 'a'.repeat(64),
      }),
    ).rejects.toThrow('payload khác');
  });
});

function duplicateError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('duplicate webhook', {
    code: 'P2002',
    clientVersion: '7.9.1',
  });
}
