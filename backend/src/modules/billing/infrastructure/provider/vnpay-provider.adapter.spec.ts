import { createHmac } from 'node:crypto';

import type {
  PaymentCheckoutInput,
  PaymentProviderConnectionDescriptor,
} from '../../application';
import { getVnpayMissingConfiguration } from './vnpay-config';
import { VnpayOperationsClient } from './vnpay-operations.client';
import { VnpayPaymentProviderAdapter } from './vnpay-provider.adapter';

const secret = 'test-only-vnpay-hash-secret';
const orderId = '3f56a498-2657-4279-a637-34a96dbb604c';
const reference = '3f56a49826574279a63734a96dbb604c';
const connection: PaymentProviderConnectionDescriptor = {
  id: 'connection',
  code: 'vnpay-main',
  kind: 'VNPAY',
  displayName: 'VNPAY',
  config: {
    environment: 'SANDBOX',
    tmnCode: 'MERCHANT',
    returnUrl: 'https://reader.example/tai-khoan/credit/ket-qua-thanh-toan',
    serverIp: '103.74.100.55',
  },
  secrets: { hashSecret: secret },
  currency: 'VND',
  orderTtlMinutes: 15,
};

function signedPayload(
  overrides: Record<string, string> = {},
): Record<string, string> {
  const fields = {
    vnp_Amount: '1000000',
    vnp_BankCode: 'NCB',
    vnp_OrderInfo: `Nap Credit ${reference}`,
    vnp_PayDate: '20260909140000',
    vnp_ResponseCode: '00',
    vnp_TmnCode: 'MERCHANT',
    vnp_TransactionNo: '14226112',
    vnp_TransactionStatus: '00',
    vnp_TxnRef: reference,
    ...overrides,
  };
  const data = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value).replace(/%20/g, '+')}`,
    )
    .join('&');
  return {
    ...fields,
    vnp_SecureHash: createHmac('sha512', secret).update(data).digest('hex'),
  };
}

describe('VNPAY checkout and IPN adapter', () => {
  const adapter = new VnpayPaymentProviderAdapter(new VnpayOperationsClient());
  const webhook = (payload: unknown) =>
    adapter.verifyWebhook({
      connection,
      providerCode: connection.code,
      headers: {},
      rawBody: Buffer.from(JSON.stringify(payload)),
    });

  beforeEach(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-09-09T06:55:00Z')),
  );
  afterEach(() => jest.useRealTimers());

  it('allows an incomplete draft but refuses to take payment without keys', () => {
    const draft = adapter.validateConfig({});
    expect(draft).toMatchObject({ environment: 'SANDBOX', locale: 'vn' });
    expect(getVnpayMissingConfiguration(draft)).toEqual([
      'tmnCode',
      'returnUrl',
      'serverIp',
      'hashSecret',
    ]);
    expect(() => adapter.assertReady({ ...connection, secrets: {} })).toThrow(
      'chưa có đủ',
    );
  });

  it.each([
    { endpoint: 'https://attacker.example' },
    { hashSecret: secret },
    { returnUrl: 'javascript:alert(1)' },
    { serverIp: 'not-an-ip' },
  ])('rejects invalid/unrecognized config %j', (config) => {
    expect(() => adapter.validateConfig(config)).toThrow();
  });

  it('creates a signed sandbox checkout with exact VND units, stable order date and return order id', async () => {
    const input: PaymentCheckoutInput = {
      connection,
      orderId,
      userId: 'user',
      amountMinor: 10_000n,
      currency: 'VND',
      createdAt: new Date('2026-09-09T06:50:00Z'),
      expiresAt: new Date('2026-09-09T07:05:00Z'),
      ipAddress: '198.51.100.10',
    };
    const checkout = await adapter.createCheckout(input);
    if (checkout.kind !== 'redirect') throw new Error('Expected redirect');
    const url = new URL(checkout.checkoutUrl);
    const params = url.searchParams;
    expect(url.origin + url.pathname).toBe(
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    );
    expect(params.get('vnp_CreateDate')).toBe('20260909135000');
    expect(params.get('vnp_ExpireDate')).toBe('20260909140500');
    expect(params.get('vnp_Amount')).toBe('1000000');
    expect(params.get('vnp_TxnRef')).toBe(reference);
    expect(
      new URL(params.get('vnp_ReturnUrl')!).searchParams.get('orderId'),
    ).toBe(orderId);
    const signature = params.get('vnp_SecureHash');
    const rawUnsignedQuery = url.search.slice(1).split('&vnp_SecureHash=')[0];
    expect(signature).toBe(
      createHmac('sha512', secret).update(rawUnsignedQuery).digest('hex'),
    );
    expect(JSON.stringify(checkout)).not.toContain(secret);
    expect(() =>
      adapter.createCheckout({ ...input, currency: 'USD' }),
    ).toThrow();
    expect(() =>
      adapter.createCheckout({ ...input, ipAddress: undefined }),
    ).toThrow();
  });

  it('normalizes verified IPN with stable replay identity and GMT+7 payment time', async () => {
    const payload = signedPayload();
    const first = await webhook(payload);
    const second = await webhook(payload);
    expect(first).toMatchObject({
      type: 'payment.succeeded',
      orderId,
      providerReference: reference,
      amountMinor: '10000',
      currency: 'VND',
      occurredAt: '2026-09-09T07:00:00.000Z',
      providerTransactionId: '14226112',
    });
    expect(second.eventId).toBe(first.eventId);
  });

  it('rejects modified signatures, wrong merchant, fractional VND and duplicate query arrays', () => {
    expect(() =>
      webhook({ ...signedPayload(), vnp_Amount: '2000000' }),
    ).toThrow('Chữ ký');
    expect(() => webhook(signedPayload({ vnp_TmnCode: 'OTHERONE' }))).toThrow(
      'Merchant',
    );
    expect(() => webhook(signedPayload({ vnp_Amount: '1000001' }))).toThrow(
      'Số tiền',
    );
    expect(() =>
      webhook({ ...signedPayload(), vnp_TxnRef: [reference, reference] }),
    ).toThrow('Trường');
  });

  it.each(['01', '04', '05', '06', '07', '99'])(
    'does not settle a responseCode 00 with transactionStatus %s',
    (status) => {
      expect(() =>
        webhook(signedPayload({ vnp_TransactionStatus: status })),
      ).toThrow('chưa xác nhận');
    },
  );

  it('only maps a confirmed terminal cancellation to failure', async () => {
    const result = await webhook(
      signedPayload({ vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }),
    );
    expect(result.type).toBe('payment.failed');
  });

  it('accepts signed success without the optional payment date using receipt time', async () => {
    const event = await webhook(signedPayload({ vnp_PayDate: '' }));
    expect(event.type).toBe('payment.succeeded');
    expect(event.occurredAt).toBe('2026-09-09T06:55:00.000Z');
    expect(event.providerTransactionDate).toBeUndefined();
  });

  it('rejects impossible payment dates and missing successful transaction identifiers', () => {
    expect(() =>
      webhook(signedPayload({ vnp_PayDate: '20260230100000' })),
    ).toThrow('Ngày');
    expect(() => webhook(signedPayload({ vnp_TransactionNo: '0' }))).toThrow(
      'Mã giao dịch',
    );
  });
});
