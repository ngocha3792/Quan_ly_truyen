import { createHmac } from 'node:crypto';
import { HmacSandboxPaymentProviderAdapter } from './hmac-sandbox-provider.adapter';

const secret = 'test-payment-webhook-secret-at-least-32-bytes';

describe('HmacSandboxPaymentProviderAdapter', () => {
  const adapter = new HmacSandboxPaymentProviderAdapter({
    checkoutBaseUrl: 'https://payments.example.test/checkout',
    returnUrl: 'https://app.example.test/credit',
    webhookSecret: secret,
    webhookSignatureTtlSeconds: 300,
  } as never);
  const connection = {
    id: '30000000-0000-4000-8000-000000000001',
    code: 'hmac-sandbox',
    kind: 'HMAC_SANDBOX' as const,
    displayName: 'Sandbox',
    config: {},
    currency: 'VND',
    orderTtlMinutes: null,
  };

  it('keeps producing a signed redirect checkout', async () => {
    const result = await adapter.createCheckout({
      orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      connection,
      amountMinor: 50_000n,
      currency: 'VND',
      expiresAt: new Date('2026-09-08T00:00:00Z'),
    });
    expect(result.kind).toBe('redirect');
    if (result.kind === 'redirect')
      expect(new URL(result.checkoutUrl).searchParams.get('signature')).toMatch(
        /^[0-9a-f]{64}$/u,
      );
  });

  it('verifies a signed webhook through the generic header bag', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = Buffer.from(
      JSON.stringify({
        eventId: 'event-1',
        type: 'payment.succeeded',
        orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        providerReference: 'sandbox-a',
        amountMinor: '50000',
        currency: 'VND',
        occurredAt: '2026-09-08T00:00:00Z',
      }),
    );
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody.toString('utf8')}`)
      .digest('hex');
    await expect(
      adapter.verifyWebhook({
        providerCode: 'hmac-sandbox',
        rawBody,
        headers: {
          'x-payment-timestamp': timestamp,
          'x-payment-signature': signature,
        },
      }),
    ).resolves.toMatchObject({ eventId: 'event-1', currency: 'VND' });
  });
});
