import { VnpayIpnService } from './vnpay-ipn.service';

describe('VNPAY IPN order binding and settlement', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const reference = id.replace(/-/gu, '');
  function setup() {
    const order = {
      id,
      provider: 'vnpay',
      providerReference: reference,
      fiatAmountMinor: 50000n,
      currency: 'VND',
      status: 'PENDING',
      providerConfigSnapshot: { tmnCode: 'OLDMERCH' },
      providerCredentialSnapshot: 'old-key',
      providerConnection: {
        code: 'vnpay',
        kind: 'VNPAY',
        enabled: false,
        encryptedCredential: 'new-key',
        config: { tmnCode: 'NEWMERCH' },
      },
    };
    const event = {
      eventId: 'event',
      orderId: id,
      type: 'payment.succeeded',
      providerReference: reference,
      amountMinor: '50000',
      currency: 'VND',
      occurredAt: new Date().toISOString(),
      providerTransactionId: '123',
    };
    const prisma = {
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue(order),
        updateMany: jest.fn(),
      },
      inboundWebhookEvent: { updateMany: jest.fn() },
    };
    const billing = {
      receiveWebhookEvent: jest.fn().mockResolvedValue({ duplicate: false }),
    };
    const adapter = { verifyWebhook: jest.fn().mockResolvedValue(event) };
    const vault = { open: jest.fn().mockReturnValue({ hashSecret: 'old' }) };
    const settlement = { settleSucceeded: jest.fn() };
    return {
      order,
      event,
      prisma,
      billing,
      adapter,
      vault,
      settlement,
      service: new VnpayIpnService(
        prisma as never,
        billing as never,
        { getAdapter: () => adapter } as never,
        vault as never,
        settlement,
      ),
    };
  }
  it('uses order credential snapshot even after disable/rotation and credits only after verified callback', async () => {
    const { service, vault, settlement, prisma } = setup();
    expect(
      await service.handle('vnpay', { vnp_TxnRef: reference }),
    ).toMatchObject({ RspCode: '00' });
    expect(vault.open).toHaveBeenCalledWith('vnpay', 'old-key');
    expect(settlement.settleSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: id, providerTransactionId: '123' }),
    );
    expect(prisma.inboundWebhookEvent.updateMany).toHaveBeenCalled();
  });
  it('does not settle invalid signatures or wrong amounts', async () => {
    const { service, adapter, event, settlement } = setup();
    adapter.verifyWebhook.mockRejectedValueOnce(new Error('signature'));
    expect(
      await service.handle('vnpay', { vnp_TxnRef: reference }),
    ).toMatchObject({ RspCode: '97' });
    event.amountMinor = '1';
    expect(
      await service.handle('vnpay', { vnp_TxnRef: reference }),
    ).toMatchObject({ RspCode: '04' });
    expect(settlement.settleSucceeded).not.toHaveBeenCalled();
  });
  it('returns replay acknowledgement for paid orders without another credit', async () => {
    const { service, order, settlement } = setup();
    order.status = 'PAID';
    expect(
      await service.handle('vnpay', { vnp_TxnRef: reference }),
    ).toMatchObject({ RspCode: '02' });
    expect(settlement.settleSucceeded).not.toHaveBeenCalled();
  });
  it('keeps durable inbox unprocessed and asks for retry if settlement fails', async () => {
    const { service, settlement, prisma } = setup();
    settlement.settleSucceeded.mockRejectedValue(new Error('database'));
    expect(
      await service.handle('vnpay', { vnp_TxnRef: reference }),
    ).toMatchObject({ RspCode: '99' });
    expect(prisma.inboundWebhookEvent.updateMany).not.toHaveBeenCalled();
  });
});
