import type {
  BillingPersistencePort,
  PaymentProviderAdapter,
  PaymentProviderRegistryPort,
} from '../../ports';
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
  const adapter = {
    kind: 'HMAC_SANDBOX',
    supportsWebhook: true,
    requiresManualReview: false,
    validateConfig: jest.fn(),
    createCheckout: jest.fn(),
    verifyWebhook: jest.fn().mockResolvedValue(normalizedEvent),
  } as jest.Mocked<PaymentProviderAdapter>;
  const registry = {
    getAdapter: jest.fn((kind: 'MANUAL_BANK_TRANSFER' | 'HMAC_SANDBOX') => {
      void kind;
      return adapter;
    }),
    listKinds: jest.fn(),
  } as jest.Mocked<PaymentProviderRegistryPort>;
  const persistence = {
    getConnectionByCode: jest.fn(),
    receiveWebhookEvent: jest.fn(),
  } as unknown as jest.Mocked<BillingPersistencePort>;
  const handler = new ProcessPaymentWebhookCommandHandler(
    registry,
    persistence,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    persistence.getConnectionByCode.mockResolvedValue({
      id: '30000000-0000-4000-8000-000000000001',
      code: 'hmac-sandbox',
      kind: 'HMAC_SANDBOX',
      displayName: 'Sandbox',
      description: null,
      config: {},
      currency: 'VND',
      enabled: true,
      sortOrder: 1,
      orderTtlMinutes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    persistence.receiveWebhookEvent.mockResolvedValue({ duplicate: false });
    adapter.verifyWebhook.mockResolvedValue(normalizedEvent);
  });

  it('persists a verified normalized event in the durable inbox', async () => {
    const rawBody = Buffer.from('{"eventId":"provider-event-1"}');
    await expect(
      handler.execute(
        new ProcessPaymentWebhookCommand('hmac-sandbox', rawBody, {
          'x-payment-timestamp': '123',
          'x-payment-signature': 'signature',
        }),
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
        new ProcessPaymentWebhookCommand('hmac-sandbox', Buffer.from('{}'), {}),
      ),
    ).resolves.toEqual({ received: true, duplicate: true });
  });
});
