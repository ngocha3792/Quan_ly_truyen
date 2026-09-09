import type {
  BillingGatewayOrder,
  BillingRefundRecord,
} from '../../ports/billing-gateway.persistence.port';
import type {
  PaymentProviderRegistryPort,
  NormalizedPaymentEvent,
} from '../../ports/payment-provider.port';
import { BillingGatewayManager } from './billing-gateway.manager';

const actorId = '40305836-464f-4e89-a980-63d5a3512f63';
const orderId = '3f56a498-2657-4279-a637-34a96dbb604c';
const order: BillingGatewayOrder = {
  orderId,
  status: 'PAID',
  providerReference: orderId.replaceAll('-', ''),
  amountMinor: 10000n,
  currency: 'VND',
  createdAt: new Date(),
  connection: {
    id: 'connection',
    code: 'vnpay',
    kind: 'VNPAY',
    displayName: 'VNPAY',
    config: {},
    currency: 'VND',
    orderTtlMinutes: 15,
  },
};
const refund: BillingRefundRecord = {
  id: actorId,
  actorId,
  orderId,
  idempotencyKey: 'billing-refund:refund-key-1',
  status: 'PENDING',
  amountMinor: '10000',
  creditAmount: '100',
  currency: 'VND',
  reason: 'Hoàn khoản nạp',
  providerRefundId: null,
  responseCode: null,
  createdAt: new Date().toISOString(),
  completedAt: null,
};
const event: NormalizedPaymentEvent = {
  eventId: 'event',
  type: 'payment.succeeded',
  orderId,
  providerReference: order.providerReference,
  amountMinor: '10000',
  currency: 'VND',
  occurredAt: new Date().toISOString(),
};

describe('billing gateway manager', () => {
  const setup = () => {
    const calls: string[] = [];
    const persistence = {
      getOrder: jest.fn().mockResolvedValue(order),
      listRefunds: jest.fn().mockResolvedValue([]),
      reserveRefund: jest.fn().mockImplementation(() => {
        calls.push('reserve');
        return Promise.resolve({ refund, replayed: false });
      }),
      finishRefund: jest.fn().mockImplementation(() => {
        calls.push('finish');
        return Promise.resolve(refund);
      }),
      applyVerifiedRefund: jest.fn().mockResolvedValue(undefined),
      recordReconciliation: jest.fn().mockResolvedValue(undefined),
    };
    const provider = {
      assertReady: jest.fn(),
      refundPayment: jest.fn().mockImplementation(() => {
        calls.push('network');
        return Promise.resolve({
          status: 'SUCCEEDED',
          responseCode: '00',
          providerRefundId: '1234',
        });
      }),
      queryPayment: jest
        .fn()
        .mockResolvedValue({ status: 'UNKNOWN', responseCode: '99' }),
    };
    const settlement = {
      settleSucceeded: jest.fn().mockResolvedValue(undefined),
    };
    const manager = new BillingGatewayManager(
      persistence,
      { getAdapter: () => provider } as unknown as PaymentProviderRegistryPort,
      settlement,
    );
    return { manager, persistence, provider, calls, settlement };
  };

  it('reserves available credits before network and finalizes after provider response', async () => {
    const { manager, persistence, calls } = setup();
    await manager.refund({
      actorId,
      orderId,
      reason: refund.reason,
      idempotencyKey: 'refund-key-1',
    });
    expect(calls).toEqual(['reserve', 'network', 'finish']);
    expect(persistence.finishRefund).toHaveBeenCalledWith(refund.id, {
      status: 'SUCCEEDED',
      responseCode: '00',
      providerRefundId: '1234',
    });
  });

  it('does not contact provider when balance reservation rejects', async () => {
    const { manager, persistence, provider } = setup();
    persistence.reserveRefund.mockRejectedValueOnce(
      new Error('INSUFFICIENT_CREDIT'),
    );
    await expect(
      manager.refund({
        actorId,
        orderId,
        reason: refund.reason,
        idempotencyKey: 'refund-key-1',
      }),
    ).rejects.toThrow('INSUFFICIENT');
    expect(provider.refundPayment).not.toHaveBeenCalled();
  });

  it('replays an unknown refund without issuing another provider request', async () => {
    const { manager, persistence, provider } = setup();
    persistence.reserveRefund.mockResolvedValueOnce({
      refund: { ...refund, status: 'UNKNOWN' },
      replayed: true,
    });
    expect(
      (
        await manager.refund({
          actorId,
          orderId,
          reason: refund.reason,
          idempotencyKey: 'refund-key-1',
        })
      ).status,
    ).toBe('UNKNOWN');
    expect(provider.refundPayment).not.toHaveBeenCalled();
  });

  it('keeps reservation unknown after network interruption', async () => {
    const { manager, persistence, provider } = setup();
    provider.refundPayment.mockRejectedValueOnce(new Error('timeout'));
    await manager.refund({
      actorId,
      orderId,
      reason: refund.reason,
      idempotencyKey: 'refund-key-1',
    });
    expect(persistence.finishRefund).toHaveBeenCalledWith(refund.id, {
      status: 'UNKNOWN',
      responseCode: 'PROVIDER_OPERATION_INTERRUPTED',
    });
  });

  it('settles confirmed late payment with the reconciliation source', async () => {
    const { manager, persistence, provider, settlement } = setup();
    persistence.getOrder.mockResolvedValueOnce({ ...order, status: 'EXPIRED' });
    provider.queryPayment.mockResolvedValueOnce({
      status: 'SUCCEEDED',
      responseCode: '00',
      event,
    });
    expect(await manager.reconcile(actorId, orderId)).toMatchObject({
      matched: true,
      status: 'PAID',
      providerStatus: 'SUCCEEDED',
    });
    expect(settlement.settleSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ orderId, source: 'reconciliation', actorId }),
    );
  });

  it('does not mark unknown result reconciled with a terminal local order', async () => {
    const { manager, settlement } = setup();
    expect(await manager.reconcile(actorId, orderId)).toMatchObject({
      matched: false,
      providerStatus: 'UNKNOWN',
    });
    expect(settlement.settleSucceeded).not.toHaveBeenCalled();
  });

  it('does not claim a held refund reconciled just because the original payment succeeded', async () => {
    const { manager, persistence, provider } = setup();
    persistence.listRefunds.mockResolvedValueOnce([
      { ...refund, status: 'UNKNOWN' },
    ]);
    provider.queryPayment.mockResolvedValueOnce({
      status: 'SUCCEEDED',
      responseCode: '00',
      event,
    });
    const result = await manager.reconcile(actorId, orderId);
    expect(result).toMatchObject({
      matched: false,
      providerStatus: 'SUCCEEDED',
    });
    expect(result.message).toContain('hoàn tiền chưa');
  });

  it('rejects an adapter result for another amount before settlement', async () => {
    const { manager, provider, settlement } = setup();
    provider.queryPayment.mockResolvedValueOnce({
      status: 'SUCCEEDED',
      responseCode: '00',
      event: { ...event, amountMinor: '20000' },
    });
    await expect(manager.reconcile(actorId, orderId)).rejects.toThrow(
      'không khớp',
    );
    expect(settlement.settleSucceeded).not.toHaveBeenCalled();
  });

  it('completes verified refund through the reservation-aware ledger path', async () => {
    const { manager, persistence, provider, settlement } = setup();
    provider.queryPayment.mockResolvedValueOnce({
      status: 'REFUNDED',
      responseCode: '00',
      providerTransactionId: 'refund123',
      event: { ...event, type: 'payment.refunded' },
    });
    persistence.getOrder
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: 'REFUNDED' });
    expect(await manager.reconcile(actorId, orderId)).toMatchObject({
      matched: true,
      providerStatus: 'REFUNDED',
    });
    expect(persistence.applyVerifiedRefund).toHaveBeenCalledWith(
      orderId,
      'refund123',
    );
    expect(settlement.settleSucceeded).not.toHaveBeenCalled();
  });

  it('requires authenticated actor and idempotency key before money operations', async () => {
    const { manager, provider } = setup();
    await expect(
      manager.refund({
        actorId: undefined,
        orderId,
        reason: refund.reason,
        idempotencyKey: 'refund-key-1',
      }),
    ).rejects.toThrow();
    await expect(
      manager.refund({
        actorId,
        orderId,
        reason: refund.reason,
        idempotencyKey: undefined,
      }),
    ).rejects.toThrow();
    expect(provider.refundPayment).not.toHaveBeenCalled();
  });
});
