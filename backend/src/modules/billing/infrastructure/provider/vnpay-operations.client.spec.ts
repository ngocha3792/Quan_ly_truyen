import { createHmac } from 'node:crypto';

import type { PaymentQueryInput, PaymentRefundInput } from '../../application';
import { VnpayOperationsClient } from './vnpay-operations.client';

const secret = 'test-only-vnpay-hash-secret';
const reference = '3f56a49826574279a63734a96dbb604c';
const input: PaymentQueryInput = {
  connection: {
    id: 'connection',
    code: 'vnpay',
    kind: 'VNPAY',
    displayName: 'VNPAY',
    currency: 'VND',
    orderTtlMinutes: 15,
    config: {
      environment: 'SANDBOX',
      tmnCode: 'MERCHANT',
      returnUrl: 'https://reader.example/return',
      serverIp: '103.74.100.55',
    },
    secrets: { hashSecret: secret },
  },
  orderId: '3f56a498-2657-4279-a637-34a96dbb604c',
  providerReference: reference,
  amountMinor: 10_000n,
  currency: 'VND',
  createdAt: new Date('2026-09-09T06:50:00Z'),
  requestId: 'request123',
  providerTransactionId: '14226112',
};
const refund: PaymentRefundInput = {
  ...input,
  requestId: 'refund123',
  initiatedBy: 'admin123',
  reason: 'Hoàn khoản nạp Credit',
};

function response(
  command: 'querydr' | 'refund',
  overrides: Record<string, string> = {},
) {
  const fields = {
    vnp_ResponseId: 'response123',
    vnp_Command: command,
    vnp_ResponseCode: '00',
    vnp_Message: 'Success',
    vnp_TmnCode: 'MERCHANT',
    vnp_TxnRef: reference,
    vnp_Amount: '1000000',
    vnp_BankCode: 'NCB',
    vnp_PayDate: '20260909140000',
    vnp_TransactionNo: command === 'refund' ? '222222' : '14226112',
    vnp_TransactionType: command === 'refund' ? '02' : '01',
    vnp_TransactionStatus: '00',
    vnp_OrderInfo: 'Request',
    ...overrides,
  };
  const signedData = [
    fields.vnp_ResponseId,
    fields.vnp_Command,
    fields.vnp_ResponseCode,
    fields.vnp_Message,
    fields.vnp_TmnCode,
    fields.vnp_TxnRef,
    fields.vnp_Amount,
    fields.vnp_BankCode,
    fields.vnp_PayDate,
    fields.vnp_TransactionNo,
    fields.vnp_TransactionType,
    fields.vnp_TransactionStatus,
    fields.vnp_OrderInfo,
    ...(command === 'querydr' ? ['', ''] : []),
  ].join('|');
  return {
    ...fields,
    vnp_SecureHash: createHmac('sha512', secret)
      .update(signedData)
      .digest('hex'),
  };
}

describe('VNPAY query and refund mappings', () => {
  const client = new VnpayOperationsClient();
  const mockResponse = (value: unknown) =>
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(value)));

  beforeEach(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-09-09T07:00:00Z')),
  );
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('signs querydr in documented field order and verifies amount and transaction', async () => {
    const fetcher = mockResponse(response('querydr'));
    expect(await client.queryPayment(input)).toMatchObject({
      status: 'SUCCEEDED',
      providerTransactionId: '14226112',
      event: { type: 'payment.succeeded', amountMinor: '10000' },
    });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
    );
    expect(init?.redirect).toBe('error');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init?.body as string) as Record<string, string>;
    const data = `request123|2.1.0|querydr|MERCHANT|${reference}|20260909135000|20260909140000|103.74.100.55|Doi soat ${reference}`;
    expect(body.vnp_SecureHash).toBe(
      createHmac('sha512', secret).update(data).digest('hex'),
    );
  });

  it.each<Record<string, string>>([
    { vnp_TmnCode: 'OTHERONE' },
    { vnp_TxnRef: 'anotherOrder' },
    { vnp_Amount: '2000000' },
    { vnp_TransactionNo: '54321' },
    { vnp_TransactionType: '03' },
  ])(
    'does not settle mismatched or partial-refund result %j',
    async (override) => {
      mockResponse(response('querydr', override));
      expect((await client.queryPayment(input)).status).toBe('UNKNOWN');
    },
  );

  it('maps full refund confirmed by querydr to a refund event', async () => {
    mockResponse(
      response('querydr', {
        vnp_TransactionType: '02',
        vnp_TransactionNo: '222222',
      }),
    );
    expect(await client.queryPayment(input)).toMatchObject({
      status: 'REFUNDED',
      event: { type: 'payment.refunded' },
    });
  });

  it('signs full refund with original payment time and uses final transaction status', async () => {
    const fetcher = mockResponse(response('refund'));
    expect(await client.refundPayment(refund)).toMatchObject({
      status: 'SUCCEEDED',
      providerRefundId: '222222',
    });
    const body = JSON.parse(fetcher.mock.calls[0][1]?.body as string) as Record<
      string,
      string
    >;
    const data = `refund123|2.1.0|refund|MERCHANT|02|${reference}|1000000|14226112|20260909135000|admin123|20260909140000|103.74.100.55|Hoan khoan nap Credit`;
    expect(body.vnp_SecureHash).toBe(
      createHmac('sha512', secret).update(data).digest('hex'),
    );
  });

  it.each(['01', '05', '06'])(
    'keeps accepted refund status %s pending without claiming money returned',
    async (status) => {
      mockResponse(response('refund', { vnp_TransactionStatus: status }));
      expect((await client.refundPayment(refund)).status).toBe('PENDING');
    },
  );

  it('keeps duplicate refund pending and maps a signed terminal rejection to failure', async () => {
    const fetcher = mockResponse(
      response('refund', { vnp_ResponseCode: '94' }),
    );
    expect((await client.refundPayment(refund)).status).toBe('PENDING');
    fetcher.mockResolvedValueOnce(
      new Response(
        JSON.stringify(response('refund', { vnp_ResponseCode: '95' })),
      ),
    );
    expect((await client.refundPayment(refund)).status).toBe('FAILED');
  });

  it('treats invalid signatures and network timeouts as unknown and never retries refunds', async () => {
    const fetcher = mockResponse({
      ...response('refund'),
      vnp_SecureHash: 'bad',
    });
    expect((await client.refundPayment(refund)).status).toBe('UNKNOWN');
    fetcher.mockRejectedValueOnce(new Error('Timeout'));
    expect((await client.refundPayment(refund)).status).toBe('UNKNOWN');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('refuses unconfigured operations before any network call', async () => {
    const fetcher = jest.spyOn(global, 'fetch');
    await expect(
      client.refundPayment({
        ...refund,
        connection: { ...input.connection, secrets: {} },
      }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
