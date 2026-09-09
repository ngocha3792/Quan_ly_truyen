import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';

import { AppConfigModule } from '@/config';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { PaymentOrderSettlementService } from '@/modules/billing/infrastructure/settlement';
import { BillingGatewayReader } from '@/modules/billing/infrastructure/gateway/billing-gateway-reader';
import { PrismaBillingGatewayPersistence } from '@/modules/billing/infrastructure/gateway/prisma-billing-gateway.persistence';
import { TransactionalReceiptService } from '@/modules/notifications';

describe('VNPAY refund credit reservation integration', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let persistence: PrismaBillingGatewayPersistence;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    persistence = new PrismaBillingGatewayPersistence(
      prisma,
      new BillingGatewayReader(prisma, {
        open: () => ({ hashSecret: 'test-only' }),
        seal: () => 'sealed',
        available: () => true,
      }),
    );
  });
  afterAll(async () => moduleRef?.close());

  async function seedPaidOrder() {
    const id = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `refund-${id}@example.test`,
        username: `refund-${id}`.slice(0, 50),
        displayName: 'Refund reader',
        emailVerifiedAt: new Date(),
      },
    });
    const pkg = await prisma.creditPackage.create({
      data: {
        code: `REF_${id.replaceAll('-', '').slice(0, 20)}`,
        label: 'Refund package',
        creditAmount: 100n,
        fiatAmountMinor: 10_000n,
        currency: 'VND',
      },
    });
    const provider = await prisma.paymentProviderConnection.create({
      data: {
        code: `vnp-${id}`,
        kind: 'VNPAY',
        displayName: 'VNPAY test',
        config: {
          environment: 'SANDBOX',
          tmnCode: 'MERCHANT',
          serverIp: '127.0.0.1',
          returnUrl: 'https://example.test/return',
        },
        currency: 'VND',
        enabled: false,
      },
    });
    const order = await prisma.paymentOrder.create({
      data: {
        id,
        userId: user.id,
        packageId: pkg.id,
        provider: provider.code,
        providerConnectionId: provider.id,
        providerReference: id.replaceAll('-', ''),
        status: 'PENDING',
        creditAmount: 100n,
        fiatAmountMinor: 10_000n,
        currency: 'VND',
        idempotencyKey: id,
        requestHash: 'a'.repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const settlement = new PaymentOrderSettlementService(prisma, {
      enqueue: jest.fn(),
    } as unknown as TransactionalReceiptService);
    await settlement.settleSucceeded({
      orderId: order.id,
      providerReference: order.providerReference!,
      occurredAt: new Date(),
      source: 'webhook',
    });
    return {
      orderId: order.id,
      actorId: user.id,
      reason: 'Hoàn khoản nạp kiểm thử',
      idempotencyKey: `refund-${id}`,
      userId: user.id,
    };
  }

  it('serializes refund reservations and never debits twice when provider acknowledgement races reconciliation', async () => {
    const input = await seedPaidOrder();
    const [first, replay] = await Promise.all([
      persistence.reserveRefund(input),
      persistence.reserveRefund(input),
    ]);
    expect([first.replayed, replay.replayed].sort()).toEqual([false, true]);
    expect(first.refund.id).toBe(replay.refund.id);
    expect(
      (
        await prisma.wallet.findUniqueOrThrow({
          where: {
            userId_currency: { userId: input.userId, currency: 'CREDIT' },
          },
        })
      ).balance,
    ).toBe(0n);
    await Promise.all([
      persistence.finishRefund(first.refund.id, {
        status: 'SUCCEEDED',
        responseCode: '00',
        providerRefundId: '1234',
      }),
      persistence.applyVerifiedRefund(input.orderId, '1234'),
    ]);
    expect(
      (
        await prisma.paymentOrder.findUniqueOrThrow({
          where: { id: input.orderId },
        })
      ).status,
    ).toBe('REFUNDED');
    const entries = await prisma.walletLedgerTransaction.findMany({
      where: { referenceId: first.refund.id },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].walletAmount).toBe(-100n);
  });

  it('keeps unknown refunds held, releases definitive failures exactly once and rejects key misuse', async () => {
    const input = await seedPaidOrder();
    const reserved = await persistence.reserveRefund(input);
    await persistence.finishRefund(reserved.refund.id, {
      status: 'UNKNOWN',
      responseCode: 'TIMEOUT',
    });
    expect((await persistence.reserveRefund(input)).replayed).toBe(true);
    await expect(
      persistence.reserveRefund({
        ...input,
        idempotencyKey: `${input.idempotencyKey}-other`,
      }),
    ).rejects.toThrow();
    await expect(
      persistence.reserveRefund({ ...input, reason: 'Changed reason' }),
    ).rejects.toThrow();
    await Promise.all([
      persistence.finishRefund(reserved.refund.id, {
        status: 'FAILED',
        responseCode: '95',
      }),
      persistence.finishRefund(reserved.refund.id, {
        status: 'FAILED',
        responseCode: '95',
      }),
    ]);
    expect(
      (
        await prisma.wallet.findUniqueOrThrow({
          where: {
            userId_currency: { userId: input.userId, currency: 'CREDIT' },
          },
        })
      ).balance,
    ).toBe(100n);
    const transactions = await prisma.walletLedgerTransaction.findMany({
      where: { referenceId: reserved.refund.id },
      include: { entries: true },
    });
    expect(transactions).toHaveLength(2);
    for (const transaction of transactions) {
      expect(transaction.entries).toHaveLength(2);
      expect(
        transaction.entries.reduce((sum, entry) => sum + entry.amount, 0n),
      ).toBe(0n);
    }
    expect(
      (
        await prisma.paymentOrder.findUniqueOrThrow({
          where: { id: input.orderId },
        })
      ).status,
    ).toBe('PAID');
  });

  it('rolls back the refund row and debit when credits were already spent', async () => {
    const input = await seedPaidOrder();
    await prisma.wallet.update({
      where: { userId_currency: { userId: input.userId, currency: 'CREDIT' } },
      data: { balance: 20n },
    });
    await expect(persistence.reserveRefund(input)).rejects.toThrow('không đủ');
    expect(
      await prisma.billingRefund.count({ where: { orderId: input.orderId } }),
    ).toBe(0);
    expect(
      await prisma.walletLedgerTransaction.count({
        where: {
          referenceType: 'billing_refund',
          wallet: { userId: input.userId },
        },
      }),
    ).toBe(0);
  });

  it('can load a disabled provider for operations on an already existing order', async () => {
    const input = await seedPaidOrder();
    expect((await persistence.getOrder(input.orderId)).connection.kind).toBe(
      'VNPAY',
    );
  });

  it('records a verified external refund without debiting a wallet that was never credited', async () => {
    const input = await seedPaidOrder();
    const original = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: input.orderId },
    });
    const pendingId = randomUUID();
    await prisma.paymentOrder.create({
      data: {
        id: pendingId,
        userId: original.userId,
        packageId: original.packageId,
        provider: original.provider,
        providerConnectionId: original.providerConnectionId,
        providerReference: pendingId.replaceAll('-', ''),
        creditAmount: original.creditAmount,
        fiatAmountMinor: original.fiatAmountMinor,
        currency: 'VND',
        status: 'EXPIRED',
        expiresAt: new Date(),
        requestHash: 'b'.repeat(64),
        idempotencyKey: pendingId,
      },
    });
    await persistence.applyVerifiedRefund(pendingId, '56789');
    expect(
      (
        await prisma.paymentOrder.findUniqueOrThrow({
          where: { id: pendingId },
        })
      ).status,
    ).toBe('REFUNDED');
    expect(
      (
        await prisma.wallet.findUniqueOrThrow({
          where: {
            userId_currency: { userId: input.userId, currency: 'CREDIT' },
          },
        })
      ).balance,
    ).toBe(100n);
  });
});
