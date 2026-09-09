import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule } from '@/config';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { PrismaBillingPersistence } from '@/modules/billing/infrastructure/persistence';
import { PaymentCredentialVault } from '@/modules/billing/infrastructure/provider/payment-credential-vault';
import {
  VnpayPaymentProviderAdapter,
  VnpayOperationsClient,
} from '@/modules/billing/infrastructure/provider';
import { PaymentOrderSettlementService } from '@/modules/billing/infrastructure/settlement';
import { VnpayIpnService } from '@/modules/billing/infrastructure/webhook/vnpay-ipn.service';
import { ManagePaymentProvidersCommandHandler } from '@/modules/billing/application/commands/manage-payment-providers/manage-payment-providers.command-handler';
import { CreatePaymentOrderCommandHandler } from '@/modules/billing/application/commands/create-payment-order/create-payment-order.command-handler';
import { CreatePaymentOrderCommand } from '@/modules/billing/application/commands/create-payment-order/create-payment-order.command';
import {
  vnpayHash,
  vnpayQuery,
} from '@/modules/billing/infrastructure/provider/vnpay-protocol';
import type { PaymentProviderRegistryPort } from '@/modules/billing/application';

describe('Admin VNPAY setup and authenticated IPN integration', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  const run = randomUUID();
  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
  });
  afterAll(async () => moduleRef?.close());

  it('keeps draft secret-free, gates rollout and credits exactly once using rotated order snapshots', async () => {
    const config = new ConfigService({
      app: { publicUrl: 'https://example.test', environment: 'test' },
      auth: {
        mfa: { encryptionKeyBase64: Buffer.alloc(32, 8).toString('base64') },
      },
    });
    const vault = new PaymentCredentialVault(config);
    const receipts = { enqueue: jest.fn() };
    const persistence = new PrismaBillingPersistence(prisma, receipts as never);
    const provider = new VnpayPaymentProviderAdapter(
      new VnpayOperationsClient(),
    );
    const registry: PaymentProviderRegistryPort = {
      getAdapter: () => provider,
      listKinds: () => ['VNPAY'],
    };
    const manager = new ManagePaymentProvidersCommandHandler(
      persistence,
      registry,
      vault,
      config,
    );
    const user = await prisma.user.create({
      data: {
        email: `vnpay-setup-${run}@example.test`,
        username: `vnp-${run}`,
        displayName: 'Setup Reader',
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.authorProfile.create({
      data: { userId: user.id, penName: 'Setup', slug: `vnp-${run}` },
    });
    const story = await prisma.story.create({
      data: {
        authorId: user.id,
        title: 'Rollout Story',
        slug: `vnp-${run}`,
        synopsis: '',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        publishedAt: new Date(),
      },
    });
    const pkg = await prisma.creditPackage.create({
      data: {
        code: `PK${run.slice(0, 8)}`,
        label: 'Credits',
        creditAmount: 100n,
        fiatAmountMinor: 10000n,
        currency: 'VND',
        isActive: true,
      },
    });
    const providerConfig = {
      environment: 'SANDBOX',
      tmnCode: 'TESTCODE',
      returnUrl: 'https://example.test/tai-khoan/credit/ket-qua-thanh-toan',
      serverIp: '127.0.0.1',
    };
    const draft = await manager.create(user.id, {
      code: `vnp-${run}`,
      kind: 'VNPAY',
      displayName: 'VNPAY',
      currency: 'VND',
      enabled: false,
      config: providerConfig,
    });
    expect(draft.configurationReady).toBe(false);
    expect(draft).not.toHaveProperty('encryptedCredential');
    await expect(
      manager.update(user.id, draft.id, { enabled: true }),
    ).rejects.toThrow();
    await manager.update(user.id, draft.id, {
      credentials: { hashSecret: 'old-merchant-key' },
    });
    await manager.update(user.id, draft.id, {
      enabled: true,
      credentials: { hashSecret: '' },
    });
    const handler = new CreatePaymentOrderCommandHandler(
      persistence,
      registry,
      { orderTtlMinutes: 30, pendingOrderLimit: 3 } as never,
      {
        enabled: true,
        paymentProviderEnabled: true,
        rolloutStage: 'general',
        internalUserIds: [],
      } as never,
      vault,
    );
    const command = new CreatePaymentOrderCommand(
      user.id,
      pkg.id,
      `order-${run}`,
      draft.id,
      story.id,
      '127.0.0.1',
    );
    await expect(handler.execute(command)).rejects.toThrow();
    await prisma.storyPaymentAllowlist.create({
      data: { storyId: story.id, isEnabled: true, enabledProviders: ['VNPAY'] },
    });
    const result = await handler.execute(command);
    expect(result.order.checkoutUrl).toContain('vnp_SecureHash');
    await manager.update(user.id, draft.id, {
      enabled: false,
      credentials: { hashSecret: 'new-merchant-key' },
    });
    const raw = {
      vnp_TxnRef: result.order.id.replace(/-/gu, ''),
      vnp_TmnCode: 'TESTCODE',
      vnp_Amount: '1000000',
      vnp_CurrCode: 'VND',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '123456',
    };
    const query = {
      ...raw,
      vnp_SecureHash: vnpayHash(vnpayQuery(raw), 'old-merchant-key'),
    };
    const ipn = new VnpayIpnService(
      prisma,
      persistence,
      registry,
      vault,
      new PaymentOrderSettlementService(prisma, receipts as never),
    );
    expect(
      await ipn.handle(draft.code, { ...query, vnp_Amount: '1' }),
    ).toMatchObject({ RspCode: '97' });
    const results = await Promise.all([
      ipn.handle(draft.code, query),
      ipn.handle(draft.code, query),
    ]);
    expect(results.every((r) => ['00', '02'].includes(r.RspCode))).toBe(true);
    expect(
      (
        await prisma.wallet.findUniqueOrThrow({
          where: { userId_currency: { userId: user.id, currency: 'CREDIT' } },
        })
      ).balance,
    ).toBe(100n);
    expect(
      await prisma.walletLedgerTransaction.count({
        where: { referenceType: 'payment_order', referenceId: result.order.id },
      }),
    ).toBe(1);
    const audits = await prisma.auditLog.findMany({
      where: { actorId: user.id },
    });
    expect(JSON.stringify(audits)).not.toContain('old-merchant-key');
    expect(JSON.stringify(audits)).not.toContain('new-merchant-key');
  });
});
