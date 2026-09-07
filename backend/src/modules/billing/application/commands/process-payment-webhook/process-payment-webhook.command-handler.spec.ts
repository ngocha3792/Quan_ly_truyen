import type { BillingPersistencePort, PaymentProviderPort } from '../../ports';
import { ProcessPaymentWebhookCommand } from './process-payment-webhook.command';
import { ProcessPaymentWebhookCommandHandler } from './process-payment-webhook.command-handler';

describe('ProcessPaymentWebhookCommandHandler', () => {
  const normalizedEvent = {
    eventId: 'provider-event-1',
    type: 'payment.succeeded' as const,
    orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    providerReference: 'provider-reference-1',
    amountMinor: '50000',
    currency: 'VND',
    occurredAt: '2026-09-07T12:00:00.000Z',
  };
  const provider: PaymentProviderPort = {
    code: 'hmac-sandbox',
    createCheckout: jest.fn(),
    verifyWebhook: jest.fn(() => normalizedEvent),
  };
  const persistence = {
    receiveWebhookEvent: jest.fn(),
  } as unknown as jest.Mocked<BillingPersistencePort>;
  const handler = new ProcessPaymentWebhookCommandHandler(
    provider,
    persistence,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    persistence.receiveWebhookEvent.mockResolvedValue({ duplicate: false });
  });

  it('persists a verified normalized event in the durable inbox', async () => {
    const rawBody = Buffer.from('{"eventId":"provider-event-1"}');

    await expect(
      handler.execute(
        new ProcessPaymentWebhookCommand(
          'hmac-sandbox',
          rawBody,
          '123',
          'signature',
        ),
      ),
    ).resolves.toEqual({ received: true, duplicate: false });

    const persisted = persistence.receiveWebhookEvent.mock.calls[0]?.[0];
    expect(persisted?.provider).toBe('hmac-sandbox');
    expect(persisted?.event).toEqual(normalizedEvent);
    expect(persisted?.payloadHash).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('acknowledges a repeated provider event without inserting it twice', async () => {
    persistence.receiveWebhookEvent.mockResolvedValue({ duplicate: true });

    await expect(
      handler.execute(
        new ProcessPaymentWebhookCommand(
          'hmac-sandbox',
          Buffer.from('{}'),
          '123',
          'signature',
        ),
      ),
    ).resolves.toEqual({ received: true, duplicate: true });
  });
});
