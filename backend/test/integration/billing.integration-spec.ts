import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';

import { AppConfigModule } from '@/config';
import {
  InboundWebhookStatus,
  PaymentOrderStatus,
  WalletCurrency,
} from '@/generated/prisma/client';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { PrismaBillingPersistence } from '@/modules/billing/infrastructure/persistence';
import { PaymentWebhookInboxProcessor } from '@/modules/billing/infrastructure/webhook';
import { PaymentOrderSettlementService } from '@/modules/billing/infrastructure/settlement';
import { TransactionalReceiptService } from '@/modules/notifications';
import { PostWalletTransactionCommandHandler } from '@/modules/wallets';
import { PrismaWalletPersistence } from '@/modules/wallets/infrastructure';

describe('billing top-up integration', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let billing: PrismaBillingPersistence;
  let processor: PaymentWebhookInboxProcessor;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [
        PrismaBillingPersistence,
        PrismaWalletPersistence,
        PaymentOrderSettlementService,
        {
          provide: TransactionalReceiptService,
          useValue: { enqueue: jest.fn() },
        },
      ],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    billing = moduleRef.get(PrismaBillingPersistence);
    processor = new PaymentWebhookInboxProcessor(
      prisma,
      new PostWalletTransactionCommandHandler(
        moduleRef.get(PrismaWalletPersistence),
      ),
      moduleRef.get(PaymentOrderSettlementService),
      { enqueue: jest.fn() } as never,
      {
        providerMode: 'hmac-sandbox',
        checkoutBaseUrl: 'https://payments.example.test/checkout',
        returnUrl: 'https://app.example.test/tai-khoan/credit',
        webhookSecret: 'test-payment-webhook-secret-at-least-32-bytes',
        webhookSignatureTtlSeconds: 300,
        webhookPollIntervalMs: 1_000,
        webhookBatchSize: 100,
        webhookMaxAttempts: 5,
        webhookRetryBaseMs: 100,
        orderTtlMinutes: 30,
        pendingOrderLimit: 3,
      },
    );
  });

  afterAll(async () => moduleRef?.close());

  it('settles a verified provider event into one top-up ledger transaction', async () => {
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `billing-${suffix}@example.test`,
        username: `billing-${suffix}`.slice(0, 50),
        displayName: `Billing ${suffix}`,
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    const creditPackage = await prisma.creditPackage.create({
      data: {
        code: `TEST_${suffix.replaceAll('-', '').slice(0, 20)}`,
        label: 'Integration package',
        creditAmount: 550n,
        fiatAmountMinor: 50_000n,
        currency: 'VND',
        isActive: true,
      },
    });
    const connection = await prisma.paymentProviderConnection.upsert({
      where: { code: 'hmac-sandbox' },
      create: {
        code: 'hmac-sandbox',
        kind: 'HMAC_SANDBOX',
        displayName: 'HMAC Sandbox',
        config: {},
        currency: 'VND',
        enabled: true,
      },
      update: { enabled: true },
    });
    const prepared = await billing.prepareOrder({
      userId: user.id,
      packageId: creditPackage.id,
      provider: 'hmac-sandbox',
      providerConnectionId: connection.id,
      idempotencyKey: `billing-${suffix}`,
      requestHash: 'a'.repeat(64),
      ttlMinutes: 30,
      pendingOrderLimit: 3,
    });
    const providerReference = `sandbox-${prepared.order.id}`;
    await billing.attachCheckout({
      orderId: prepared.order.id,
      providerReference,
      checkoutUrl: 'https://payments.example.test/checkout',
    });
    await prisma.inboundWebhookEvent.create({
      data: {
        provider: 'payment:hmac-sandbox',
        eventKey: `event-${suffix}`,
        payloadHash: 'b'.repeat(64),
        eventType: 'payment.succeeded',
        status: InboundWebhookStatus.PENDING,
        payload: {
          eventId: `event-${suffix}`,
          type: 'payment.succeeded',
          orderId: prepared.order.id,
          providerReference,
          amountMinor: '50000',
          currency: 'VND',
          occurredAt: new Date().toISOString(),
        },
      },
    });

    await expect(processor.processBatch()).resolves.toMatchObject({
      scanned: 1,
      processed: 1,
      failed: 0,
    });
    await expect(processor.processBatch()).resolves.toMatchObject({
      scanned: 0,
    });

    const [order, wallet, topUps, reconciliation] = await Promise.all([
      prisma.paymentOrder.findUniqueOrThrow({
        where: { id: prepared.order.id },
      }),
      prisma.wallet.findUniqueOrThrow({
        where: {
          userId_currency: { userId: user.id, currency: WalletCurrency.CREDIT },
        },
      }),
      prisma.walletLedgerTransaction.count({
        where: {
          wallet: { userId: user.id },
          type: 'TOP_UP',
          referenceType: 'payment_order',
          referenceId: prepared.order.id,
        },
      }),
      billing.reconcile(),
    ]);
    expect(order.status).toBe(PaymentOrderStatus.PAID);
    expect(order.walletTransactionId).not.toBeNull();
    expect(wallet.balance).toBe(550n);
    expect(topUps).toBe(1);
    expect(reconciliation).toMatchObject({
      paidOrdersWithoutLedger: 0,
      orphanTopUpTransactions: 0,
      pendingExpiredOrders: 0,
    });
  });

  it('keeps manual claims uncredited until an admin settlement and credits exactly once', async () => {
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `manual-${suffix}@example.test`,
        username: `manual-${suffix}`.slice(0, 50),
        displayName: 'Manual payer',
        emailVerifiedAt: new Date(),
      },
    });
    const creditPackage = await prisma.creditPackage.create({
      data: {
        code: `MANUAL_${suffix.replaceAll('-', '').slice(0, 20)}`,
        label: 'Manual package',
        creditAmount: 100n,
        fiatAmountMinor: 10_000n,
        currency: 'VND',
        isActive: true,
      },
    });
    const connection = await prisma.paymentProviderConnection.create({
      data: {
        code: `manual-${suffix}`.slice(0, 50),
        kind: 'MANUAL_BANK_TRANSFER',
        displayName: 'Test bank',
        config: {
          bankName: 'VCB',
          accountNumber: '123',
          accountHolder: 'TEST',
          transferNoteTemplate: 'NAP {{reference}}',
        },
        currency: 'VND',
        enabled: true,
        orderTtlMinutes: 2880,
      },
    });
    const prepared = await billing.prepareOrder({
      userId: user.id,
      packageId: creditPackage.id,
      provider: connection.code,
      providerConnectionId: connection.id,
      idempotencyKey: `manual-${suffix}`,
      requestHash: 'c'.repeat(64),
      ttlMinutes: 2880,
      pendingOrderLimit: 3,
    });
    const reference = `TT${prepared.order.id.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    await billing.attachInstructions({
      orderId: prepared.order.id,
      providerReference: reference,
      instructions: {
        bankName: 'VCB',
        accountNumber: '123',
        accountHolder: 'TEST',
        transferNote: `NAP ${reference}`,
      },
    });
    const claimed = await billing.markOrderTransferred({
      userId: user.id,
      orderId: prepared.order.id,
      referenceCode: 'FT123',
    });
    expect(claimed.status).toBe(PaymentOrderStatus.AWAITING_REVIEW);
    expect(await prisma.wallet.count({ where: { userId: user.id } })).toBe(0);
    const settlement = moduleRef.get(PaymentOrderSettlementService);
    const input = {
      orderId: prepared.order.id,
      providerReference: reference,
      occurredAt: new Date(),
      source: 'admin_manual' as const,
      actorId: user.id,
      reason: 'Đã đối soát chuyển khoản hợp lệ',
    };
    await settlement.settleSucceeded(input);
    await settlement.settleSucceeded(input);
    expect(
      (
        await prisma.paymentOrder.findUniqueOrThrow({
          where: { id: prepared.order.id },
        })
      ).status,
    ).toBe(PaymentOrderStatus.PAID);
    expect(
      (
        await prisma.wallet.findUniqueOrThrow({
          where: {
            userId_currency: {
              userId: user.id,
              currency: WalletCurrency.CREDIT,
            },
          },
        })
      ).balance,
    ).toBe(100n);
    expect(
      await prisma.walletLedgerTransaction.count({
        where: {
          referenceType: 'payment_order',
          referenceId: prepared.order.id,
        },
      }),
    ).toBe(1);
  });
});
