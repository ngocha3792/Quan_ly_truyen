import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';

import { AppConfigModule, monetizationConfig } from '@/config';
import {
  ChapterStatus,
  StoryStatus,
  StoryVisibility,
  WalletCurrency,
} from '@/generated/prisma/client';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { PrismaChapterPersistence } from '@/modules/chapters/infrastructure';
import { MEDIA_URL_BUILDER } from '@/modules/media';
import {
  SetChapterMonetizationCommand,
  SetChapterMonetizationCommandHandler,
  RefundChapterPurchaseCommand,
  RefundChapterPurchaseCommandHandler,
  UnlockChapterCommand,
  UnlockChapterCommandHandler,
} from '@/modules/monetization';
import { PrismaMonetizationPersistence } from '@/modules/monetization/infrastructure';
import { TransactionalReceiptService } from '@/modules/notifications';
import {
  PostWalletTransactionCommand,
  PostWalletTransactionCommandHandler,
} from '@/modules/wallets';
import { PrismaWalletPersistence } from '@/modules/wallets/infrastructure';

describe('chapter monetization integration', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let setPricing: SetChapterMonetizationCommandHandler;
  let unlock: UnlockChapterCommandHandler;
  let postWallet: PostWalletTransactionCommandHandler;
  let refund: RefundChapterPurchaseCommandHandler;
  let chapterReader: PrismaChapterPersistence;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [
        PrismaMonetizationPersistence,
        PrismaWalletPersistence,
        PrismaChapterPersistence,
        {
          provide: MEDIA_URL_BUILDER,
          useValue: {
            build: jest.fn(() => 'https://media.test/chapter-image'),
          },
        },
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
    const monetization = moduleRef.get(PrismaMonetizationPersistence);
    chapterReader = moduleRef.get(PrismaChapterPersistence);
    setPricing = new SetChapterMonetizationCommandHandler(monetization);
    unlock = new UnlockChapterCommandHandler(monetization);
    refund = new RefundChapterPurchaseCommandHandler(monetization);
    postWallet = new PostWalletTransactionCommandHandler(
      moduleRef.get(PrismaWalletPersistence),
    );
  });

  afterAll(async () => moduleRef?.close());

  it('purchases, refunds with balanced compensation, and supports repurchase', async () => {
    const { authorId, buyerId, chapterId } = await createPublishedChapter();
    const band = await prisma.monetizationPriceBand.findFirstOrThrow({
      where: { isActive: true },
      orderBy: { creditPrice: 'asc' },
    });
    await postWallet.execute(
      new PostWalletTransactionCommand(
        buyerId,
        'CREDIT',
        'TOP_UP',
        'CREDIT',
        100n,
        'PAYMENT_CLEARING',
        `monetization-seed-${randomUUID()}`,
        'test-credit',
        randomUUID(),
      ),
    );

    const configured = await setPricing.execute(
      new SetChapterMonetizationCommand(
        authorId,
        (await prisma.chapter.findUniqueOrThrow({ where: { id: chapterId } }))
          .storyId,
        chapterId,
        'PAID',
        band.id,
      ),
    );
    const attempts = await Promise.all([
      unlock.execute(
        new UnlockChapterCommand(buyerId, chapterId, `unlock-${randomUUID()}`),
      ),
      unlock.execute(
        new UnlockChapterCommand(buyerId, chapterId, `unlock-${randomUUID()}`),
      ),
    ]);

    expect(configured).toMatchObject({
      accessType: 'PAID',
      creditPrice: band.creditPrice.toString(),
      version: 2,
    });
    const chapterIdentity = await prisma.chapter.findUniqueOrThrow({
      where: { id: chapterId },
      select: { story: { select: { slug: true } } },
    });
    const lockedReader = await chapterReader.findPublicReader(
      chapterIdentity.story.slug,
      '1',
      undefined,
      true,
    );
    expect(lockedReader?.chapter.access.state).toBe('LOCKED');
    expect(JSON.stringify(lockedReader)).not.toContain(
      'FULL_CONTENT_SENTINEL_MUST_NOT_LEAK',
    );
    expect(attempts.filter((result) => !result.alreadyOwned)).toHaveLength(1);
    expect(attempts.filter((result) => result.alreadyOwned)).toHaveLength(1);
    await expect(
      prisma.chapterPurchase.count({ where: { userId: buyerId, chapterId } }),
    ).resolves.toBe(1);
    await expect(
      prisma.chapterEntitlement.count({
        where: { userId: buyerId, chapterId },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.wallet.findUniqueOrThrow({
        where: {
          userId_currency: { userId: buyerId, currency: WalletCurrency.CREDIT },
        },
        select: { balance: true },
      }),
    ).resolves.toEqual({ balance: 100n - band.creditPrice });

    const purchase = await prisma.chapterPurchase.findFirstOrThrow({
      where: { userId: buyerId, chapterId },
    });
    const refundReason = 'Hoàn theo yêu cầu integration test hợp lệ';
    const firstRefund = await refund.execute(
      new RefundChapterPurchaseCommand(
        authorId,
        purchase.id,
        refundReason,
        `refund-${randomUUID()}`,
      ),
    );
    const replayedRefund = await refund.execute(
      new RefundChapterPurchaseCommand(
        authorId,
        purchase.id,
        refundReason,
        `refund-${randomUUID()}`,
      ),
    );

    expect(firstRefund).toMatchObject({
      walletBalance: '100',
      replayed: false,
    });
    expect(replayedRefund).toMatchObject({
      walletBalance: '100',
      replayed: true,
    });
    const refunded = await prisma.chapterPurchase.findUniqueOrThrow({
      where: { id: purchase.id },
      include: { refundWalletTransaction: { include: { entries: true } } },
    });
    expect(refunded.status).toBe('REFUNDED');
    expect(refunded.refundReason).toBe(refundReason);
    expect(
      refunded.refundWalletTransaction?.entries.reduce(
        (sum, entry) => sum + entry.amount,
        0n,
      ),
    ).toBe(0n);
    await expect(
      prisma.chapterEntitlement.findUniqueOrThrow({
        where: { userId_chapterId: { userId: buyerId, chapterId } },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: 'REVOKED' });

    const repurchase = await unlock.execute(
      new UnlockChapterCommand(buyerId, chapterId, `unlock-${randomUUID()}`),
    );
    expect(repurchase).toMatchObject({ alreadyOwned: false, replayed: false });
    await expect(
      prisma.chapterPurchase.count({ where: { userId: buyerId, chapterId } }),
    ).resolves.toBe(2);
    await expect(
      prisma.chapterEntitlement.findUniqueOrThrow({
        where: { userId_chapterId: { userId: buyerId, chapterId } },
        select: { status: true, purchaseId: true },
      }),
    ).resolves.toEqual({
      status: 'ACTIVE',
      purchaseId: repurchase.purchase.id,
    });
  });

  it('opens early access without charging new readers and retains purchase and pricing snapshots', async () => {
    const { authorId, buyerId, chapterId } = await createPublishedChapter();
    const chapter = await prisma.chapter.findUniqueOrThrow({
      where: { id: chapterId },
      include: { story: true },
    });
    const band = await prisma.monetizationPriceBand.findFirstOrThrow({
      where: { isActive: true },
      orderBy: { creditPrice: 'asc' },
    });
    const deadline = new Date(Date.now() + 86_400_000);
    await setPricing.execute(
      new SetChapterMonetizationCommand(
        authorId,
        chapter.storyId,
        chapterId,
        'PAID',
        band.id,
        'EARLY_ACCESS',
        deadline,
      ),
    );
    const before = await chapterReader.findPublicReader(
      chapter.story.slug,
      '1',
      undefined,
      true,
    );
    expect(before?.chapter.access).toMatchObject({
      state: 'LOCKED',
      freeAt: deadline.toISOString(),
      unlockPolicy: 'EARLY_ACCESS',
    });
    await postWallet.execute(
      new PostWalletTransactionCommand(
        buyerId,
        'CREDIT',
        'TOP_UP',
        'CREDIT',
        100n,
        'PAYMENT_CLEARING',
        `early-credit-${randomUUID()}`,
        'test-credit',
        randomUUID(),
      ),
    );
    const purchase = await unlock.execute(
      new UnlockChapterCommand(
        buyerId,
        chapterId,
        `early-unlock-${randomUUID()}`,
      ),
    );
    const snapshot = await prisma.chapterPricingVersion.findFirstOrThrow({
      where: { chapterId },
      orderBy: { version: 'desc' },
    });
    await setPricing.execute(
      new SetChapterMonetizationCommand(
        authorId,
        chapter.storyId,
        chapterId,
        'PAID',
        band.id,
        'EARLY_ACCESS',
        new Date(Date.now() - 1000),
      ),
    );
    const after = await chapterReader.findPublicReader(
      chapter.story.slug,
      '1',
      undefined,
      true,
    );
    expect(after?.chapter.access.state).toBe('FREE');
    expect(after?.chapter).toHaveProperty('content', chapter.content);
    const newBuyer = await createUser(`early-new-${randomUUID()}`);
    await expect(
      unlock.execute(
        new UnlockChapterCommand(
          newBuyer.id,
          chapterId,
          `early-free-${randomUUID()}`,
        ),
      ),
    ).rejects.toMatchObject({ code: 'CHAPTER_NOT_PURCHASABLE' });
    expect(
      await prisma.chapterPurchase.count({ where: { userId: newBuyer.id } }),
    ).toBe(0);
    expect(
      await prisma.chapterPurchase.findUniqueOrThrow({
        where: { id: purchase.purchase.id },
      }),
    ).toMatchObject({ creditPrice: band.creditPrice, status: 'COMPLETED' });
    expect(
      await prisma.chapterEntitlement.findUniqueOrThrow({
        where: { userId_chapterId: { userId: buyerId, chapterId } },
      }),
    ).toMatchObject({ status: 'ACTIVE' });
    expect(
      await prisma.chapterPricingVersion.findUniqueOrThrow({
        where: { id: snapshot.id },
      }),
    ).toEqual(snapshot);
  });

  it('anchors a draft paid window to publication rather than pricing configuration time', async () => {
    const { authorId, chapterId } = await createPublishedChapter();
    const chapter = await prisma.chapter.update({
      where: { id: chapterId },
      data: { status: 'DRAFT', publishedAt: null },
      include: { story: true },
    });
    const band = await prisma.monetizationPriceBand.findFirstOrThrow({
      where: { isActive: true },
    });
    const config = await setPricing.execute(
      new SetChapterMonetizationCommand(
        authorId,
        chapter.storyId,
        chapterId,
        'PAID',
        band.id,
        'EARLY_ACCESS',
        undefined,
        1,
      ),
    );
    expect(config.freeAt).toBeNull();
    const publishedAt = new Date(Date.now() - 2 * 86_400_000);
    await prisma.chapter.update({
      where: { id: chapterId },
      data: { status: 'PUBLISHED', publishedAt },
    });
    const reader = await chapterReader.findPublicReader(
      chapter.story.slug,
      '1',
      undefined,
      true,
    );
    expect(reader?.chapter.access).toMatchObject({
      state: 'FREE',
      freeAt: new Date(publishedAt.getTime() + 86_400_000).toISOString(),
    });
    const stored = await prisma.chapterMonetization.findUniqueOrThrow({
      where: { chapterId },
    });
    expect(stored).toMatchObject({
      accessType: 'PAID',
      freeAt: null,
      paidWindowDays: 1,
      creditPrice: band.creditPrice,
    });
  });

  async function createPublishedChapter(): Promise<{
    authorId: string;
    buyerId: string;
    chapterId: string;
  }> {
    const suffix = randomUUID();
    const [author, buyer] = await Promise.all([
      createUser(`author-${suffix}`),
      createUser(`buyer-${suffix}`),
    ]);
    await prisma.authorProfile.create({
      data: {
        userId: author.id,
        penName: `Pen ${suffix}`,
        slug: `pen-${suffix}`,
      },
    });
    const publishedAt = new Date();
    const story = await prisma.story.create({
      data: {
        authorId: author.id,
        title: `Story ${suffix}`,
        slug: `story-${suffix}`,
        synopsis: 'Monetization integration story.',
        status: StoryStatus.PUBLISHED,
        visibility: StoryVisibility.PUBLIC,
        publishedAt,
      },
    });
    const chapter = await prisma.chapter.create({
      data: {
        storyId: story.id,
        createdById: author.id,
        updatedById: author.id,
        number: 1,
        title: 'Paid chapter',
        slug: `paid-${suffix}`,
        content:
          `${'Nội dung preview an toàn. '.repeat(80)}` +
          'FULL_CONTENT_SENTINEL_MUST_NOT_LEAK',
        status: ChapterStatus.PUBLISHED,
        wordCount: 200,
        publishedAt,
        monetization: { create: { accessType: 'FREE', version: 1 } },
      },
    });
    return { authorId: author.id, buyerId: buyer.id, chapterId: chapter.id };
  }

  function createUser(label: string) {
    return prisma.user.create({
      data: {
        email: `${label}@monetization.test`,
        username: label.slice(0, 50),
        displayName: label,
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
  }
});
