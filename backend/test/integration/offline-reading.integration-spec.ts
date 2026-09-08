import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';

import { AppConfigModule } from '@/config';
import {
  ChapterAccessType,
  ChapterStatus,
  MediaPurpose,
  MediaResourceType,
  MediaStatus,
  OfflinePackageStatus,
  StoryStatus,
  StoryVisibility,
  WalletCurrency,
  WalletSystemAccount,
  WalletTransactionType,
} from '@/generated/prisma/client';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { MEDIA_URL_BUILDER } from '@/modules/media';
import { PrismaOfflineReadingPersistence } from '@/modules/offline-reading/infrastructure';

describe('offline reading persistence integration', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let persistence: PrismaOfflineReadingPersistence;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [
        PrismaOfflineReadingPersistence,
        {
          provide: MEDIA_URL_BUILDER,
          useValue: {
            build: jest.fn(() => 'https://media.test/offline-slice'),
          },
        },
      ],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    persistence = moduleRef.get(PrismaOfflineReadingPersistence);
  });

  afterAll(async () => moduleRef?.close());

  it('enforces entitlement and quota, pins media, and releases packages on revocation', async () => {
    const fixture = await createFixture();
    const firstRequest = packageRequest(fixture, 'first');

    await expect(persistence.createPackage(firstRequest)).rejects.toMatchObject(
      { code: 'OFFLINE_CHAPTER_UNAVAILABLE' },
    );

    const entitlementId = await grantEntitlement(fixture);
    const created = await persistence.createPackage(firstRequest);

    expect(created).toMatchObject({
      status: OfflinePackageStatus.READY,
      chapterCount: 1,
    });
    await expect(
      prisma.offlinePackageMediaPin.count({
        where: {
          packageId: created.id,
          mediaAssetId: fixture.mediaAssetId,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      persistence.getQuota(fixture.buyerId, fixture.now),
    ).resolves.toMatchObject({
      currentPackages: 1,
      remainingPackages: 0,
    });

    await expect(
      persistence.createPackage(packageRequest(fixture, 'quota-overflow')),
    ).rejects.toMatchObject({ code: 'OFFLINE_QUOTA_EXCEEDED' });

    await prisma.chapterMedia.delete({
      where: {
        chapterId_mediaAssetId: {
          chapterId: fixture.chapterId,
          mediaAssetId: fixture.mediaAssetId,
        },
      },
    });
    await expect(
      prisma.mediaAsset.delete({ where: { id: fixture.mediaAssetId } }),
    ).rejects.toThrow();

    const revokedAt = new Date(fixture.now.getTime() + 1_000);
    await prisma.chapterEntitlement.update({
      where: { id: entitlementId },
      data: { status: 'REVOKED', revokedAt },
    });

    await expect(
      prisma.offlinePackage.findUniqueOrThrow({
        where: { id: created.id },
        select: { status: true, revokedReason: true },
      }),
    ).resolves.toEqual({
      status: OfflinePackageStatus.REVOKED,
      revokedReason: 'chapter_entitlement_revoked',
    });
    await expect(
      prisma.offlinePackageMediaPin.count({ where: { packageId: created.id } }),
    ).resolves.toBe(0);
    await expect(
      persistence.getQuota(fixture.buyerId, revokedAt),
    ).resolves.toMatchObject({ currentPackages: 0, remainingPackages: 1 });

    await prisma.chapterEntitlement.update({
      where: { id: entitlementId },
      data: { status: 'ACTIVE', revokedAt: null },
    });
    await prisma.chapterMedia.create({
      data: {
        chapterId: fixture.chapterId,
        mediaAssetId: fixture.mediaAssetId,
        sortOrder: 0,
      },
    });
    const second = await persistence.createPackage(
      packageRequest({ ...fixture, now: revokedAt }, 'session-revocation'),
    );
    await expect(
      prisma.offlinePackageMediaPin.count({ where: { packageId: second.id } }),
    ).resolves.toBe(1);
    await prisma.session.update({
      where: { id: fixture.sessionId },
      data: {
        revokedAt: new Date(revokedAt.getTime() + 1_000),
        revokedReason: 'offline-integration-test',
      },
    });

    await expect(
      prisma.offlinePackage.findUniqueOrThrow({
        where: { id: second.id },
        select: { status: true, revokedReason: true },
      }),
    ).resolves.toEqual({
      status: OfflinePackageStatus.REVOKED,
      revokedReason: 'offline-integration-test',
    });
    await expect(
      prisma.offlinePackageMediaPin.count({ where: { packageId: second.id } }),
    ).resolves.toBe(0);
    await prisma.chapterMedia.delete({
      where: {
        chapterId_mediaAssetId: {
          chapterId: fixture.chapterId,
          mediaAssetId: fixture.mediaAssetId,
        },
      },
    });
    await expect(
      prisma.mediaAsset.delete({ where: { id: fixture.mediaAssetId } }),
    ).resolves.toMatchObject({ id: fixture.mediaAssetId });
  });

  async function createFixture(): Promise<OfflineFixture> {
    const suffix = randomUUID();
    const now = new Date('2026-09-09T00:00:00.000Z');
    const [author, buyer, priceBand] = await Promise.all([
      createUser(`offline-author-${suffix}`),
      createUser(`offline-buyer-${suffix}`),
      prisma.monetizationPriceBand.findFirstOrThrow({
        where: { isActive: true },
        orderBy: { creditPrice: 'asc' },
      }),
    ]);
    await prisma.authorProfile.create({
      data: {
        userId: author.id,
        penName: `Offline ${suffix}`,
        slug: `offline-${suffix}`,
      },
    });
    const story = await prisma.story.create({
      data: {
        authorId: author.id,
        title: `Offline story ${suffix}`,
        slug: `offline-story-${suffix}`,
        synopsis: 'Offline reading integration fixture.',
        status: StoryStatus.PUBLISHED,
        visibility: StoryVisibility.PUBLIC,
        publishedAt: now,
      },
    });
    const chapter = await prisma.chapter.create({
      data: {
        storyId: story.id,
        createdById: author.id,
        updatedById: author.id,
        number: 1,
        title: 'Paid offline chapter',
        slug: `paid-offline-${suffix}`,
        content: 'Nội dung chương trả phí dùng cho kiểm thử offline.',
        status: ChapterStatus.PUBLISHED,
        wordCount: 10,
        publishedAt: now,
        monetization: {
          create: {
            accessType: ChapterAccessType.PAID,
            priceBandId: priceBand.id,
            creditPrice: priceBand.creditPrice,
            previewContent: 'Nội dung xem trước.',
          },
        },
      },
    });
    const media = await prisma.mediaAsset.create({
      data: {
        uploaderId: author.id,
        purpose: MediaPurpose.CHAPTER_IMAGE,
        status: MediaStatus.READY,
        storageProvider: 'cloudinary',
        publicId: `offline/${suffix}`,
        resourceType: MediaResourceType.IMAGE,
        deliveryType: 'authenticated',
        width: 800,
        height: 1_200,
        sizeBytes: 2_048n,
        readyAt: now,
      },
    });
    await prisma.chapterMedia.create({
      data: {
        chapterId: chapter.id,
        mediaAssetId: media.id,
        sortOrder: 0,
      },
    });
    const session = await prisma.session.create({
      data: {
        userId: buyer.id,
        refreshTokenHash: `offline-refresh-${suffix}`,
        deviceId: `offline-device-${suffix}`,
        expiresAt: new Date(now.getTime() + 86_400_000),
      },
    });
    await prisma.offlineQuota.upsert({
      where: { userId: buyer.id },
      create: { userId: buyer.id, maxPackages: 1 },
      update: { maxPackages: 1 },
    });
    return {
      buyerId: buyer.id,
      sessionId: session.id,
      chapterId: chapter.id,
      mediaAssetId: media.id,
      priceBandId: priceBand.id,
      creditPrice: priceBand.creditPrice,
      now,
    };
  }

  async function grantEntitlement(fixture: OfflineFixture): Promise<string> {
    const wallet = await prisma.wallet.create({
      data: {
        userId: fixture.buyerId,
        currency: WalletCurrency.CREDIT,
        balance: 0n,
      },
    });
    const walletTransaction = await prisma.walletLedgerTransaction.create({
      data: {
        walletId: wallet.id,
        currency: WalletCurrency.CREDIT,
        type: WalletTransactionType.CHAPTER_PURCHASE,
        idempotencyKey: `offline-purchase-${randomUUID()}`,
        requestHash: 'a'.repeat(64),
        referenceType: 'chapter',
        referenceId: fixture.chapterId,
        walletAmount: -fixture.creditPrice,
        walletBalanceAfter: 0n,
        entries: {
          create: [
            {
              walletId: wallet.id,
              currency: WalletCurrency.CREDIT,
              amount: -fixture.creditPrice,
            },
            {
              systemAccount: WalletSystemAccount.PLATFORM_REVENUE,
              currency: WalletCurrency.CREDIT,
              amount: fixture.creditPrice,
            },
          ],
        },
      },
    });
    const purchase = await prisma.chapterPurchase.create({
      data: {
        userId: fixture.buyerId,
        chapterId: fixture.chapterId,
        priceBandId: fixture.priceBandId,
        creditPrice: fixture.creditPrice,
        walletTransactionId: walletTransaction.id,
        idempotencyKey: `offline-entitlement-${randomUUID()}`,
        requestHash: 'b'.repeat(64),
      },
    });
    const entitlement = await prisma.chapterEntitlement.create({
      data: {
        userId: fixture.buyerId,
        chapterId: fixture.chapterId,
        purchaseId: purchase.id,
      },
    });
    return entitlement.id;
  }

  function createUser(label: string) {
    return prisma.user.create({
      data: {
        email: `${label}@offline.test`,
        username: label.slice(0, 50),
        displayName: label,
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
  }
});

interface OfflineFixture {
  readonly buyerId: string;
  readonly sessionId: string;
  readonly chapterId: string;
  readonly mediaAssetId: string;
  readonly priceBandId: string;
  readonly creditPrice: bigint;
  readonly now: Date;
}

function packageRequest(fixture: OfflineFixture, label: string) {
  return {
    userId: fixture.buyerId,
    sessionId: fixture.sessionId,
    name: `Offline ${label}`,
    description: null,
    chapterIds: [fixture.chapterId],
    now: fixture.now,
  };
}
