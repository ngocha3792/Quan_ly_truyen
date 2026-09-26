import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';

import { AppConfigModule, monetizationConfig } from '@/config';
import {
  ChapterPurchaseStatus,
  ChapterStatus,
  StoryStatus,
  StoryVisibility,
  WalletCurrency,
} from '@/generated/prisma/client';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import {
  DeleteAuthorChapterCommand,
  DeleteAuthorChapterCommandHandler,
} from '@/modules/chapters';
import { PrismaChapterPersistence } from '@/modules/chapters/infrastructure';
import { MEDIA_URL_BUILDER } from '@/modules/media';
import {
  RefundChapterPurchasesCommandHandler,
  SetChapterMonetizationCommand,
  SetChapterMonetizationCommandHandler,
  UnlockChapterCommand,
  UnlockChapterCommandHandler,
} from '@/modules/monetization';
import { PrismaMonetizationPersistence } from '@/modules/monetization/infrastructure';
import { TransactionalReceiptService } from '@/modules/notifications';
import {
  DeleteAuthorStoryCommand,
  DeleteAuthorStoryCommandHandler,
} from '@/modules/stories/application';
import { PrismaStoryPersistence } from '@/modules/stories/infrastructure';
import {
  PostWalletTransactionCommand,
  PostWalletTransactionCommandHandler,
} from '@/modules/wallets';
import { PrismaWalletPersistence } from '@/modules/wallets/infrastructure';

/**
 * Xoá nội dung đã bán là động vào tiền của người khác, nên phần đáng tin duy
 * nhất là chạy thật trên Postgres: mua bằng ví thật, xoá, rồi đọc lại số dư
 * và trạng thái giao dịch.
 */
describe('delete published content with refund integration', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let setPricing: SetChapterMonetizationCommandHandler;
  let unlock: UnlockChapterCommandHandler;
  let postWallet: PostWalletTransactionCommandHandler;
  let deleteChapter: DeleteAuthorChapterCommandHandler;
  let deleteStory: DeleteAuthorStoryCommandHandler;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [
        PrismaMonetizationPersistence,
        PrismaWalletPersistence,
        PrismaChapterPersistence,
        PrismaStoryPersistence,
        {
          provide: MEDIA_URL_BUILDER,
          useValue: { build: jest.fn(() => 'https://media.test/image') },
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
    const refunds = new RefundChapterPurchasesCommandHandler(monetization);
    setPricing = new SetChapterMonetizationCommandHandler(monetization);
    unlock = new UnlockChapterCommandHandler(monetization);
    postWallet = new PostWalletTransactionCommandHandler(
      moduleRef.get(PrismaWalletPersistence),
    );
    deleteChapter = new DeleteAuthorChapterCommandHandler(
      moduleRef.get(PrismaChapterPersistence),
      refunds,
    );
    deleteStory = new DeleteAuthorStoryCommandHandler(
      moduleRef.get(PrismaStoryPersistence),
      refunds,
    );
  });

  afterAll(async () => moduleRef?.close());

  it('hoàn tiền đúng một chương bị xoá và để yên chương còn lại', async () => {
    const world = await createStoryWithTwoPaidChapters();
    const [firstPurchase, secondPurchase] = await Promise.all([
      buy(world.buyerId, world.firstChapterId),
      buy(world.buyerId, world.secondChapterId),
    ]);
    const balanceAfterBuying = await readBalance(world.buyerId);

    await deleteChapter.execute(
      new DeleteAuthorChapterCommand(
        world.authorId,
        world.storyId,
        world.firstChapterId,
        '127.0.0.1',
        'Jest',
        randomUUID(),
      ),
    );

    const [refunded, untouched] = await Promise.all([
      prisma.chapterPurchase.findUniqueOrThrow({
        where: { id: firstPurchase },
      }),
      prisma.chapterPurchase.findUniqueOrThrow({
        where: { id: secondPurchase },
      }),
    ]);
    expect(refunded.status).toBe(ChapterPurchaseStatus.REFUNDED);
    expect(untouched.status).toBe(ChapterPurchaseStatus.COMPLETED);

    // Tiền chương bị xoá quay về ví, chương còn lại vẫn trừ như cũ.
    expect(await readBalance(world.buyerId)).toBe(
      balanceAfterBuying + refunded.creditPrice,
    );

    const deleted = await prisma.chapter.findUniqueOrThrow({
      where: { id: world.firstChapterId },
      select: { deletedAt: true },
    });
    expect(deleted.deletedAt).not.toBeNull();

    // Quyền đọc bị thu hồi để chương biến mất khỏi tủ sách người đã mua.
    expect(
      await prisma.chapterEntitlement.count({
        where: {
          chapterId: world.firstChapterId,
          userId: world.buyerId,
          status: 'ACTIVE',
        },
      }),
    ).toBe(0);

    expect(
      await prisma.auditLog.count({
        where: { action: 'chapter.deleted', entityId: world.firstChapterId },
      }),
    ).toBe(1);
  });

  it('hoàn mọi lượt mua của truyện rồi xoá cả truyện lẫn chương', async () => {
    const world = await createStoryWithTwoPaidChapters();
    await Promise.all([
      buy(world.buyerId, world.firstChapterId),
      buy(world.buyerId, world.secondChapterId),
    ]);
    const spent = TOP_UP - (await readBalance(world.buyerId));
    expect(spent).toBeGreaterThan(0n);

    await deleteStory.execute(
      new DeleteAuthorStoryCommand(
        world.authorId,
        world.storyId,
        '127.0.0.1',
        'Jest',
        randomUUID(),
      ),
    );

    // Trả lại đủ, không thiếu một giao dịch nào.
    expect(await readBalance(world.buyerId)).toBe(TOP_UP);
    expect(
      await prisma.chapterPurchase.count({
        where: {
          chapter: { storyId: world.storyId },
          status: ChapterPurchaseStatus.COMPLETED,
        },
      }),
    ).toBe(0);

    const story = await prisma.story.findUniqueOrThrow({
      where: { id: world.storyId },
      select: { deletedAt: true },
    });
    expect(story.deletedAt).not.toBeNull();
    expect(
      await prisma.chapter.count({
        where: { storyId: world.storyId, deletedAt: null },
      }),
    ).toBe(0);
  });

  it('người lạ không kích được lệnh hoàn tiền trên chương của tác giả khác', async () => {
    const world = await createStoryWithTwoPaidChapters();
    const purchaseId = await buy(world.buyerId, world.firstChapterId);
    const balance = await readBalance(world.buyerId);

    await expect(
      deleteChapter.execute(
        new DeleteAuthorChapterCommand(
          world.buyerId,
          world.storyId,
          world.firstChapterId,
          undefined,
          undefined,
          randomUUID(),
        ),
      ),
    ).rejects.toThrow();

    expect(
      (
        await prisma.chapterPurchase.findUniqueOrThrow({
          where: { id: purchaseId },
        })
      ).status,
    ).toBe(ChapterPurchaseStatus.COMPLETED);
    expect(await readBalance(world.buyerId)).toBe(balance);
    expect(
      (
        await prisma.chapter.findUniqueOrThrow({
          where: { id: world.firstChapterId },
          select: { deletedAt: true },
        })
      ).deletedAt,
    ).toBeNull();
  });

  it('vẫn chặn xoá khi truyện đang chờ duyệt', async () => {
    const world = await createStoryWithTwoPaidChapters();
    await prisma.story.update({
      where: { id: world.storyId },
      data: { status: StoryStatus.PENDING_REVIEW },
    });

    await expect(
      deleteStory.execute(
        new DeleteAuthorStoryCommand(
          world.authorId,
          world.storyId,
          undefined,
          undefined,
          randomUUID(),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      deleteChapter.execute(
        new DeleteAuthorChapterCommand(
          world.authorId,
          world.storyId,
          world.firstChapterId,
          undefined,
          undefined,
          randomUUID(),
        ),
      ),
    ).rejects.toThrow();

    expect(
      (
        await prisma.story.findUniqueOrThrow({
          where: { id: world.storyId },
          select: { deletedAt: true },
        })
      ).deletedAt,
    ).toBeNull();
  });

  const TOP_UP = 1_000n;

  async function buy(buyerId: string, chapterId: string): Promise<string> {
    const result = await unlock.execute(
      new UnlockChapterCommand(buyerId, chapterId, `unlock-${randomUUID()}`),
    );
    return result.purchase.id;
  }

  async function readBalance(userId: string): Promise<bigint> {
    const wallet = await prisma.wallet.findFirstOrThrow({
      where: { userId, currency: WalletCurrency.CREDIT },
      select: { balance: true },
    });
    return wallet.balance;
  }

  async function createStoryWithTwoPaidChapters(): Promise<{
    authorId: string;
    buyerId: string;
    storyId: string;
    firstChapterId: string;
    secondChapterId: string;
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
        synopsis: 'Delete-with-refund integration story.',
        status: StoryStatus.PUBLISHED,
        visibility: StoryVisibility.PUBLIC,
        publishedAt,
      },
    });
    const [first, second] = await Promise.all([
      createChapter(story.id, author.id, 1, suffix, publishedAt),
      createChapter(story.id, author.id, 2, suffix, publishedAt),
    ]);

    await postWallet.execute(
      new PostWalletTransactionCommand(
        buyer.id,
        'CREDIT',
        'TOP_UP',
        'CREDIT',
        TOP_UP,
        'PAYMENT_CLEARING',
        `delete-refund-seed-${suffix}`,
        'test-credit',
        randomUUID(),
      ),
    );

    const band = await prisma.monetizationPriceBand.findFirstOrThrow({
      where: { isActive: true },
      orderBy: { creditPrice: 'asc' },
    });
    for (const chapterId of [first, second]) {
      await setPricing.execute(
        new SetChapterMonetizationCommand(
          author.id,
          story.id,
          chapterId,
          'PAID',
          band.id,
        ),
      );
    }

    return {
      authorId: author.id,
      buyerId: buyer.id,
      storyId: story.id,
      firstChapterId: first,
      secondChapterId: second,
    };
  }

  async function createChapter(
    storyId: string,
    authorId: string,
    number: number,
    suffix: string,
    publishedAt: Date,
  ): Promise<string> {
    const chapter = await prisma.chapter.create({
      data: {
        storyId,
        createdById: authorId,
        updatedById: authorId,
        number,
        title: `Chương ${number}`,
        slug: `chuong-${number}-${suffix}`,
        content: 'Nội dung chương trả phí. '.repeat(40),
        status: ChapterStatus.PUBLISHED,
        wordCount: 160,
        publishedAt,
        monetization: { create: { accessType: 'FREE', version: 1 } },
      },
      select: { id: true },
    });
    return chapter.id;
  }

  function createUser(label: string) {
    return prisma.user.create({
      data: {
        email: `${label}@delete-refund.test`,
        username: label.slice(0, 50),
        displayName: label,
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
  }
});
