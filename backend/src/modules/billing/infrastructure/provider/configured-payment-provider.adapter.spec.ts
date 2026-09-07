import { createHmac } from 'node:crypto';

import { ConfiguredPaymentProviderAdapter } from './configured-payment-provider.adapter';

const WEBHOOK_SECRET = 'test-payment-webhook-secret-at-least-32-bytes';

function createAdapter(
  overrides: Partial<
    ConstructorParameters<typeof ConfiguredPaymentProviderAdapter>[0]
  > = {},
): ConfiguredPaymentProviderAdapter {
  return new ConfiguredPaymentProviderAdapter({
    providerMode: 'hmac-sandbox',
    checkoutBaseUrl: 'https://payments.example.test/checkout',
    returnUrl: 'https://app.example.test/tai-khoan/credit',
    webhookSecret: WEBHOOK_SECRET,
    webhookSignatureTtlSeconds: 300,
    webhookPollIntervalMs: 1_000,
    webhookBatchSize: 100,
    webhookMaxAttempts: 5,
    webhookRetryBaseMs: 5_000,
    orderTtlMinutes: 30,
    pendingOrderLimit: 3,
    ...overrides,
  });
}

describe('ConfiguredPaymentProviderAdapter', () => {
  it('creates a server-signed sandbox checkout using the order snapshot', async () => {
    const adapter = createAdapter();
    const expiresAt = new Date('2026-09-08T00:00:00.000Z');

    const result = await adapter.createCheckout({
      orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      amountMinor: 50_000n,
      currency: 'VND',
      expiresAt,
    });

    const url = new URL(result.checkoutUrl);
    expect(result.providerReference).toBe(
      'sandbox-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect(url.searchParams.get('amountMinor')).toBe('50000');
    expect(url.searchParams.get('currency')).toBe('VND');
    expect(url.searchParams.get('signature')).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('verifies and normalizes a signed webhook event', () => {
    const adapter = createAdapter();
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const rawBody = Buffer.from(
      JSON.stringify({
        eventId: 'event-001',
        type: 'payment.succeeded',
        orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        providerReference: 'sandbox-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        amountMinor: '50000',
        currency: 'vnd',
        occurredAt: '2026-09-07T12:00:00.000Z',
      }),
    );
    const signature = createHmac('sha256', WEBHOOK_SECRET)
      .update(`${timestamp}.${rawBody.toString('utf8')}`)
      .digest('hex');

    expect(
      adapter.verifyWebhook({
        providerCode: 'hmac-sandbox',
        rawBody,
        timestamp,
        signature,
      }),
    ).toEqual({
      eventId: 'event-001',
      type: 'payment.succeeded',
      orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      providerReference: 'sandbox-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      amountMinor: '50000',
      currency: 'VND',
      occurredAt: '2026-09-07T12:00:00.000Z',
    });
  });

  it('rejects stale or incorrectly signed webhooks', () => {
    const adapter = createAdapter();
    const rawBody = Buffer.from('{}');

    expect(() =>
      adapter.verifyWebhook({
        providerCode: 'hmac-sandbox',
        rawBody,
        timestamp: '1',
        signature: 'invalid',
      }),
    ).toThrow('Timestamp webhook');

    expect(() =>
      adapter.verifyWebhook({
        providerCode: 'hmac-sandbox',
        rawBody,
        timestamp: String(Math.floor(Date.now() / 1_000)),
        signature: 'invalid',
      }),
    ).toThrow('Chữ ký webhook');
  });

  it('fails closed when no provider is configured', () => {
    const adapter = createAdapter({ providerMode: 'disabled' });

    expect(() =>
      adapter.createCheckout({
        orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        amountMinor: 10_000n,
        currency: 'VND',
        expiresAt: new Date(),
      }),
    ).toThrow();
  });
});
