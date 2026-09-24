import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';

import { AppConfigModule, monetizationConfig } from '@/config';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { PrismaMonetizationPersistence } from '@/modules/monetization/infrastructure';
import { TransactionalReceiptService } from '@/modules/notifications';
import { allocatePurchaseRevenue } from '@/modules/revenue';
import { RevenueAllocationPersistence } from '@/modules/revenue/infrastructure/persistence/revenue-allocation.persistence';
import { PrismaRevenuePayoutPersistence } from '@/modules/revenue/infrastructure/persistence/prisma-revenue-payout.persistence';
import { PrismaWalletPersistence } from '@/modules/wallets/infrastructure';

describe('revenue PostgreSQL allocations, settlement and payouts', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let monetization: PrismaMonetizationPersistence;
  let payouts: PrismaRevenuePayoutPersistence;
  let settlement: RevenueAllocationPersistence;
  let wallets: PrismaWalletPersistence;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [
        PrismaMonetizationPersistence,
        PrismaWalletPersistence,
        {
          provide: monetizationConfig.KEY,
          useValue: {
            enabled: true,
            authorPricingEnabled: true,
            paymentProviderEnabled: false,
            paywallEnforcementEnabled: true,
            rolloutStage: 'general',
            internalUserIds: [],
            storyAllowlistIds: [],
            integrityMetricsIntervalMs: 60_000,
          },
        },
        {
          provide: TransactionalReceiptService,
          useValue: { enqueue: jest.fn() },
        },
      ],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    monetization = moduleRef.get(PrismaMonetizationPersistence);
    wallets = moduleRef.get(PrismaWalletPersistence);
    payouts = new PrismaRevenuePayoutPersistence(prisma);
    settlement = new RevenueAllocationPersistence(prisma);
  });

  afterAll(async () => moduleRef?.close());

  it('allocates one atomic purchase exactly, including contributor shares and integer rounding', async () => {
    const fixture = await seed({ price: 101n, contributor: true });
    await Promise.all([purchase(fixture), purchase(fixture)]);
    const order = await purchaseRow(fixture);
    await Promise.all([
      prisma.$transaction((tx) => allocatePurchaseRevenue(tx, order.id)),
      prisma.$transaction((tx) => allocatePurchaseRevenue(tx, order.id)),
    ]);
    const allocations = await prisma.revenueAllocation.findMany({
      where: { purchaseId: order.id },
    });
    expect(allocations).toHaveLength(3);
    expect(allocations.reduce((sum, row) => sum + row.netAmount, 0n)).toBe(
      101n,
    );
    expect(
      allocations.reduce((sum, row) => sum + row.shareBasisPoints, 0),
    ).toBe(10_000);
    expect(
      allocations.find((row) => row.allocationType === 'AUTHOR_SHARE')
        ?.netAmount,
    ).toBe(71n);
    expect(
      allocations.find((row) => row.allocationType === 'CONTRIBUTOR')
        ?.netAmount,
    ).toBe(10n);
    expect(
      allocations.find((row) => row.allocationType === 'PLATFORM_FEE')
        ?.netAmount,
    ).toBe(20n);
    expect(
      await prisma.chapterPurchase.count({
        where: { userId: fixture.buyerId },
      }),
    ).toBe(1);
    expect((await wallets.findBalance(fixture.buyerId, 'CREDIT')).balance).toBe(
      9_899n,
    );
    await assertBalancedJournal();
  });

  it('rolls back the wallet debit and entitlement when allocation has no approved agreement', async () => {
    const fixture = await seed({ agreement: false });
    await expect(purchase(fixture)).rejects.toThrow();
    expect((await wallets.findBalance(fixture.buyerId, 'CREDIT')).balance).toBe(
      10_000n,
    );
    expect(
      await prisma.chapterPurchase.count({
        where: { userId: fixture.buyerId },
      }),
    ).toBe(0);
    expect(
      await prisma.chapterEntitlement.count({
        where: { userId: fixture.buyerId },
      }),
    ).toBe(0);
  });

  it('keeps monetary snapshots immutable and enforces balanced allocations at database commit', async () => {
    const fixture = await seed();
    await purchase(fixture);
    const order = await purchaseRow(fixture);
    const authorAllocation = await prisma.revenueAllocation.findFirstOrThrow({
      where: { purchaseId: order.id, allocationType: 'AUTHOR_SHARE' },
    });
    await expect(
      prisma.revenueAllocation.update({
        where: { id: authorAllocation.id },
        data: { netAmount: authorAllocation.netAmount + 1n },
      }),
    ).rejects.toThrow();
    expect(
      (
        await prisma.revenueAllocation.findUniqueOrThrow({
          where: { id: authorAllocation.id },
        })
      ).netAmount,
    ).toBe(700n);
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.revenueAllocation.create({
          data: {
            purchaseId: order.id,
            agreementId: authorAllocation.agreementId,
            recipientUserId: fixture.contributorId,
            allocationType: 'CONTRIBUTOR',
            grossAmount: order.creditPrice,
            shareBasisPoints: 1,
            netAmount: 1n,
          },
        });
      }),
    ).rejects.toThrow();
    expect(
      await prisma.revenueAllocation.count({ where: { purchaseId: order.id } }),
    ).toBe(2);
  });

  it('applies the snapshotted settlement delay once, including concurrent worker retries', async () => {
    const fixture = await seed({ delay: 7 });
    await purchase(fixture);
    const order = await purchaseRow(fixture);
    const dueAt = new Date(order.createdAt.getTime() + 7 * 86_400_000);
    await settlement.settlePending(100, new Date(dueAt.getTime() - 1));
    expect((await payouts.getEarnings(fixture.authorId)).available).toBe('0');
    expect((await payouts.getEarnings(fixture.authorId)).pending).toBe('700');
    await Promise.all([
      settlement.settlePending(100, dueAt),
      settlement.settlePending(100, dueAt),
    ]);
    expect((await payouts.getEarnings(fixture.authorId)).available).toBe('700');
    expect(
      await prisma.authorEarningLedger.count({
        where: { userId: fixture.authorId },
      }),
    ).toBe(1);
    await assertBalancedJournal();
  });

  it('compensates refunds before settlement with exact negative rows and no duplicate reversal', async () => {
    const fixture = await seed({ delay: 7, contributor: true, price: 101n });
    await purchase(fixture);
    const order = await purchaseRow(fixture);
    await Promise.all([refund(fixture, order.id), refund(fixture, order.id)]);
    const rows = await prisma.revenueAllocation.findMany({
      where: { purchaseId: order.id },
    });
    expect(rows).toHaveLength(6);
    expect(rows.reduce((sum, row) => sum + row.netAmount, 0n)).toBe(0n);
    for (const original of rows.filter((row) => !row.isRefund)) {
      expect(
        rows.find((row) => row.refundsAllocationId === original.id)?.netAmount,
      ).toBe(-original.netAmount);
    }
    expect((await payouts.getEarnings(fixture.authorId)).available).toBe('0');
    expect((await payouts.getEarnings(fixture.contributorId)).available).toBe(
      '0',
    );
    await settlement.settlePending(100, new Date(Date.now() + 10 * 86_400_000));
    expect((await payouts.getEarnings(fixture.authorId)).available).toBe('0');
    await assertBalancedJournal();
  });

  it('reserves partial earnings exactly and serializes repeated and competing payout requests', async () => {
    const fixture = await seed();
    await purchase(fixture);
    await settlement.settlePending();
    const account = await verifiedAccount(fixture);
    const key = randomUUID();
    const [first, replay] = await Promise.all([
      payouts.createRequest(fixture.authorId, account.id, '300', key),
      payouts.createRequest(fixture.authorId, account.id, '300', key),
    ]);
    expect(first.id).toBe(replay.id);
    const holds = await prisma.payoutEarningReservation.findMany({
      where: { requestId: first.id },
    });
    expect(holds.reduce((sum, row) => sum + row.amount, 0n)).toBe(300n);
    expect((await payouts.getEarnings(fixture.authorId)).available).toBe('400');
    const attempts = await Promise.allSettled([
      payouts.createRequest(fixture.authorId, account.id, '300', randomUUID()),
      payouts.createRequest(fixture.authorId, account.id, '300', randomUUID()),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === 'fulfilled'),
    ).toHaveLength(1);
    expect((await payouts.getEarnings(fixture.authorId)).available).toBe('100');
    await expect(
      payouts.createRequest(fixture.authorId, account.id, '301', key),
    ).rejects.toThrow();
    await payouts.cancelRequest(fixture.authorId, first.id);
    await payouts.cancelRequest(fixture.authorId, first.id);
    expect((await payouts.getEarnings(fixture.authorId)).available).toBe('400');
    await assertBalancedJournal();
  });

  it('requires verified active account ownership and the minimum withdrawal before reserving', async () => {
    const fixture = await seed();
    await purchase(fixture);
    await settlement.settlePending();
    const account = await createAccount(fixture);
    await expect(
      payouts.createRequest(fixture.authorId, account.id, '100', randomUUID()),
    ).rejects.toThrow();
    await payouts.reviewAccount(fixture.platformId, account.id, {
      verified: true,
      reference: 'Reviewed test KYC case',
    });
    await expect(
      payouts.createRequest(fixture.buyerId, account.id, '100', randomUUID()),
    ).rejects.toThrow();
    await expect(
      payouts.createRequest(fixture.authorId, account.id, '99', randomUUID()),
    ).rejects.toThrow();
    await payouts.updateAccount(fixture.authorId, account.id, {
      isActive: false,
    });
    await expect(
      payouts.createRequest(fixture.authorId, account.id, '100', randomUUID()),
    ).rejects.toThrow();
    expect(
      await prisma.payoutRequest.count({ where: { userId: fixture.authorId } }),
    ).toBe(0);
    expect((await payouts.getEarnings(fixture.authorId)).available).toBe('700');
  });

  it('snapshots fees, tax, conversion and payee when policy and account data later change', async () => {
    const fixture = await seed({ price: 2_000n });
    await purchase(fixture);
    await settlement.settlePending();
    const account = await verifiedAccount(fixture);
    await policy(fixture.platformId, {
      feeBasisPoints: 250,
      taxBasisPoints: 500,
    });
    const request = await payouts.createRequest(
      fixture.authorId,
      account.id,
      '1000',
      randomUUID(),
    );
    expect(request).toMatchObject({
      feeAmount: '25',
      taxAmount: '50',
      netAmount: '925',
      fiatAmountMinor: '925000',
    });
    const before = await prisma.payoutRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    await policy(fixture.platformId, {
      feeBasisPoints: 900,
      fiatMinorPerCredit: '2000',
    });
    await prisma.payoutAccount.update({
      where: { id: account.id },
      data: { accountNumber: '9876543210' },
    });
    const after = await prisma.payoutRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    expect(after.policySnapshot).toEqual(before.policySnapshot);
    expect(after.accountSnapshot).toEqual(before.accountSnapshot);
    expect(after.fiatAmountMinor).toBe(925_000n);
  });

  it('closes a batch after evidenced completion and failure while balancing paid and released earnings', async () => {
    const fixture = await seed();
    await purchase(fixture);
    await settlement.settlePending();
    const account = await verifiedAccount(fixture);
    const first = await payouts.createRequest(
      fixture.authorId,
      account.id,
      '200',
      randomUUID(),
    );
    const second = await payouts.createRequest(
      fixture.authorId,
      account.id,
      '100',
      randomUUID(),
    );
    const batch = await payouts.createBatch(fixture.platformId, [
      first.id,
      second.id,
    ]);
    expect(
      (await payouts.exportBatch(fixture.platformId, batch.id)).items,
    ).toHaveLength(2);
    const proof = {
      providerTxnId: randomUUID(),
      evidenceReference: 'bank-confirmation-test',
    };
    await Promise.all([
      payouts.completeRequest(fixture.platformId, first.id, proof),
      payouts.completeRequest(fixture.platformId, first.id, proof),
    ]);
    expect(
      (await prisma.payoutBatch.findUniqueOrThrow({ where: { id: batch.id } }))
        .status,
    ).toBe('PROCESSING');
    await payouts.failRequest(fixture.platformId, second.id, {
      reason: 'Bank rejected account',
      evidenceReference: 'bank-rejection-test',
    });
    expect(
      (await prisma.payoutBatch.findUniqueOrThrow({ where: { id: batch.id } }))
        .status,
    ).toBe('COMPLETED');
    expect(await payouts.getEarnings(fixture.authorId)).toMatchObject({
      available: '500',
      reserved: '0',
      paid: '200',
    });
    expect(await payouts.reconcile()).toMatchObject({
      healthy: true,
      differenceCredits: '0',
      legacyUnallocatedPurchaseCount: 0,
      mismatchedRequests: [],
      unbalancedEvents: [],
    });
    await assertBalancedJournal();
  });

  it('keeps refunded paid earnings as debt and prevents another withdrawal', async () => {
    const fixture = await seed();
    await purchase(fixture);
    await settlement.settlePending();
    const account = await verifiedAccount(fixture);
    const request = await payouts.createRequest(
      fixture.authorId,
      account.id,
      '200',
      randomUUID(),
    );
    await payouts.createBatch(fixture.platformId, [request.id]);
    await payouts.completeRequest(fixture.platformId, request.id, {
      providerTxnId: randomUUID(),
      evidenceReference: 'bank-refund-race-test',
    });
    await refund(fixture, (await purchaseRow(fixture)).id);
    expect((await payouts.getEarnings(fixture.authorId)).available).toBe(
      '-200',
    );
    await expect(
      payouts.createRequest(fixture.authorId, account.id, '100', randomUUID()),
    ).rejects.toThrow();
    expect(
      (
        await prisma.payoutRequest.findUniqueOrThrow({
          where: { id: request.id },
        })
      ).status,
    ).toBe('COMPLETED');
    await assertBalancedJournal();
  });

  async function seed(
    options: {
      price?: bigint;
      delay?: number;
      contributor?: boolean;
      agreement?: boolean;
    } = {},
  ) {
    const [author, buyer, platform, contributor] = await Promise.all(
      ['author', 'buyer', 'platform', 'contributor'].map(async (role) => {
        const label = `${role}-${randomUUID()}`;
        return prisma.user.create({
          data: {
            email: `${label}@revenue.test`,
            username: label.slice(0, 50),
            displayName: label,
            emailVerifiedAt: new Date(),
          },
        });
      }),
    );
    await prisma.authorProfile.create({
      data: {
        userId: author.id,
        penName: author.displayName,
        slug: author.username,
      },
    });
    await policy(platform.id, { settlementDelayDays: options.delay ?? 0 });
    const publishedAt = new Date();
    const story = await prisma.story.create({
      data: {
        authorId: author.id,
        title: author.displayName,
        slug: author.username,
        synopsis: 'Revenue integration fixture',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        publishedAt,
      },
    });
    const band = await prisma.monetizationPriceBand.create({
      data: {
        code: randomUUID(),
        label: 'Revenue test',
        creditPrice: options.price ?? 1_000n,
      },
    });
    const chapter = await prisma.chapter.create({
      data: {
        storyId: story.id,
        createdById: author.id,
        updatedById: author.id,
        number: 1,
        title: 'Revenue chapter',
        slug: `chapter-${randomUUID()}`,
        content: 'Paid content for revenue integration.',
        status: 'PUBLISHED',
        publishedAt,
        wordCount: 6,
        monetization: {
          create: {
            accessType: 'PAID',
            priceBandId: band.id,
            creditPrice: band.creditPrice,
            previewContent: 'Paid preview for revenue integration.',
          },
        },
      },
    });
    if (options.agreement !== false) {
      await prisma.revenueShareAgreement.create({
        data: {
          storyId: story.id,
          authorUserId: author.id,
          platformUserId: platform.id,
          authorShare: '0.7000',
          platformFee: options.contributor ? '0.2000' : '0.3000',
          ...(options.contributor
            ? {
                contributorShares: [{ userId: contributor.id, shareBps: 1000 }],
              }
            : {}),
          createdBy: platform.id,
          approvedBy: platform.id,
          approvedAt: publishedAt,
          effectiveFrom: publishedAt,
        },
      });
    }
    await wallets.postTransaction({
      userId: buyer.id,
      currency: 'CREDIT',
      type: 'TOP_UP',
      walletAmount: 10_000n,
      systemAccount: 'PAYMENT_CLEARING',
      idempotencyKey: randomUUID(),
      requestHash: 'a'.repeat(64),
      referenceType: 'revenue-test-credit',
      referenceId: randomUUID(),
    });
    return {
      authorId: author.id,
      buyerId: buyer.id,
      platformId: platform.id,
      contributorId: contributor.id,
      storyId: story.id,
      chapterId: chapter.id,
    };
  }

  type Fixture = Awaited<ReturnType<typeof seed>>;
  function purchase(fixture: Fixture) {
    return monetization.unlockChapter({
      userId: fixture.buyerId,
      chapterId: fixture.chapterId,
      idempotencyKey: randomUUID(),
      requestHash: 'b'.repeat(64),
    });
  }
  function purchaseRow(fixture: Fixture) {
    return prisma.chapterPurchase.findFirstOrThrow({
      where: { userId: fixture.buyerId, chapterId: fixture.chapterId },
    });
  }
  function refund(fixture: Fixture, purchaseId: string) {
    return monetization.refundChapterPurchase({
      actorId: fixture.platformId,
      purchaseId,
      reason: 'Verified integration refund',
      requestHash: 'c'.repeat(64),
    });
  }
  function createAccount(fixture: Fixture) {
    return payouts.createAccount(fixture.authorId, {
      method: 'BANK_TRANSFER',
      accountName: 'Revenue test author',
      bankName: 'Test bank',
      accountNumber: '0123456789',
      kycReference: `private-case:${fixture.authorId}`,
    });
  }
  async function verifiedAccount(fixture: Fixture) {
    const account = await createAccount(fixture);
    return payouts.reviewAccount(fixture.platformId, account.id, {
      verified: true,
      reference: 'Test KYC identity and account reviewed',
    });
  }
  function policy(
    platformId: string,
    overrides: Partial<
      Parameters<PrismaRevenuePayoutPersistence['updatePolicy']>[1]
    > = {},
  ) {
    return payouts.updatePolicy(platformId, {
      enabled: true,
      settlementDelayDays: 0,
      minimumPayoutCredits: '100',
      minimumPlatformFeeBasisPoints: 1000,
      feeBasisPoints: 0,
      taxBasisPoints: 0,
      fiatMinorPerCredit: '1000',
      platformUserId: platformId,
      ...overrides,
    });
  }
  async function assertBalancedJournal() {
    const events = await prisma.revenueJournalEntry.groupBy({
      by: ['eventKey'],
      _sum: { amount: true },
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events.filter((event) => event._sum.amount !== 0n)).toEqual([]);
  }
});
