import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';

import { AppConfigModule } from '@/config';
import {
  ChapterStatus,
  StoryStatus,
  StoryVisibility,
  WalletCurrency,
} from '@/generated/prisma/client';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import {
  SetChapterMonetizationCommand,
  SetChapterMonetizationCommandHandler,
  UnlockChapterCommand,
  UnlockChapterCommandHandler,
} from '@/modules/monetization';
import { PrismaMonetizationPersistence } from '@/modules/monetization/infrastructure';
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

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [PrismaMonetizationPersistence, PrismaWalletPersistence],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    const monetization = moduleRef.get(PrismaMonetizationPersistence);
    setPricing = new SetChapterMonetizationCommandHandler(monetization);
    unlock = new UnlockChapterCommandHandler(monetization);
    postWallet = new PostWalletTransactionCommandHandler(
      moduleRef.get(PrismaWalletPersistence),
    );
  });

  afterAll(async () => moduleRef?.close());

  it('prices a chapter and grants one permanent entitlement with one atomic debit', async () => {
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
          'Nội dung chương trả phí đủ dài để tạo preview an toàn. '.repeat(20),
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
