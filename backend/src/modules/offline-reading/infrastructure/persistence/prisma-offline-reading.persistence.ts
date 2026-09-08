import { Buffer } from 'node:buffer';

import { Inject, Injectable } from '@nestjs/common';

import {
  ChapterAccessType,
  ChapterPurchaseStatus,
  ChapterStatus,
  MediaSliceStatus,
  MediaStatus,
  OfflineChapterAccessState,
  OfflinePackageStatus,
  Prisma,
  StoryStatus,
  StoryVisibility,
} from '@/generated/prisma/client';
import {
  AppException,
  AuthenticationRequiredException,
} from '@/common/exceptions';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';
import {
  createBackfilledChapterContentDocument,
  isChapterContentDocument,
  type ChapterContentDocument,
} from '@/modules/chapters';
import { MEDIA_URL_BUILDER, type MediaUrlPort } from '@/modules/media';

import type {
  CreateOfflinePackageInput,
  OfflinePackageManifestDto,
  OfflinePackageSummaryDto,
  OfflineQuotaDto,
  OfflineReadingPersistencePort,
  OwnedOfflinePackageInput,
  SessionBoundOfflinePackageInput,
  TouchOfflinePackageResultDto,
} from '../../application';
import {
  OfflineChapterUnavailableException,
  OfflineEntitlementPolicy,
  OfflinePackageNotFoundException,
  OfflinePackagePolicy,
  OfflinePackageSessionMismatchException,
  OfflinePackageUnavailableException,
  OfflineQuotaExceededException,
} from '../../domain';
import {
  createOfflineMediaSnapshot,
  mapOfflineMediaSnapshot,
} from './offline-media-snapshot';

const PACKAGE_SUMMARY_SELECT = {
  id: true,
  deviceId: true,
  name: true,
  description: true,
  status: true,
  totalSizeBytes: true,
  chapterCount: true,
  licenseExpiresAt: true,
  lastAccessedAt: true,
  autoDeleteAt: true,
  revokedAt: true,
  revokedReason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OfflinePackageSelect;

const PACKAGE_MANIFEST_SELECT = {
  ...PACKAGE_SUMMARY_SELECT,
  userId: true,
  sessionId: true,
  chapters: {
    orderBy: [{ storyTitle: 'asc' }, { chapterNumber: 'asc' }],
    select: {
      chapterId: true,
      storyId: true,
      storySlug: true,
      storyTitle: true,
      chapterNumber: true,
      chapterTitle: true,
      chapterSlug: true,
      chapterVersion: true,
      content: true,
      contentFormat: true,
      contentDocument: true,
      documentSchemaVersion: true,
      wordCount: true,
      publishedAt: true,
      accessType: true,
      accessState: true,
      priceCredits: true,
      entitlementId: true,
      mediaSnapshot: true,
      snapshotAt: true,
    },
  },
} satisfies Prisma.OfflinePackageSelect;

type PackageSummaryRow = Prisma.OfflinePackageGetPayload<{
  select: typeof PACKAGE_SUMMARY_SELECT;
}>;
type PackageManifestRow = Prisma.OfflinePackageGetPayload<{
  select: typeof PACKAGE_MANIFEST_SELECT;
}>;

@Injectable()
export class PrismaOfflineReadingPersistence implements OfflineReadingPersistencePort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_URL_BUILDER)
    private readonly mediaUrl: MediaUrlPort,
  ) {}

  async createPackage(
    input: CreateOfflinePackageInput,
  ): Promise<OfflinePackageSummaryDto> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const session = await lockActiveSession(tx, input);
        await lockChapterSources(tx, input.chapterIds, input.userId);
        await lockUserPackages(tx, input.userId);
        const quota = await lockAndRefreshQuota(tx, input.userId, input.now);

        OfflinePackagePolicy.assertChapterSelection(
          input.chapterIds,
          quota.maxChaptersPerPackage,
        );

        const chapters = await loadChapterSources(
          tx,
          input.chapterIds,
          input.userId,
        );
        const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));
        const snapshots = input.chapterIds.map((chapterId) => {
          const chapter = byId.get(chapterId);
          if (!chapter?.publishedAt) {
            throw new OfflineChapterUnavailableException(
              chapterId,
              'Chương không tồn tại hoặc chưa được xuất bản công khai',
            );
          }

          const accessType =
            chapter.monetization?.accessType ?? ChapterAccessType.FREE;
          const entitlement = chapter.entitlements[0] ?? null;
          const decision = OfflineEntitlementPolicy.verify({
            accessType,
            priceCredits: chapter.monetization?.creditPrice ?? null,
            entitlementId:
              entitlement?.purchase.status === ChapterPurchaseStatus.COMPLETED
                ? entitlement.id
                : null,
            entitlementStatus:
              entitlement?.purchase.status === ChapterPurchaseStatus.COMPLETED
                ? entitlement.status
                : null,
          });
          if (!decision.allowed) {
            throw new OfflineChapterUnavailableException(
              chapter.id,
              decision.reason,
            );
          }

          const contentDocument = normalizeContentDocument(
            chapter.contentDocument,
            chapter.content,
            chapter.id,
          );
          const media = createOfflineMediaSnapshot(
            chapter.media,
            accessType === ChapterAccessType.PAID,
          );
          const contentSizeBytes = BigInt(
            Buffer.byteLength(chapter.content, 'utf8') +
              Buffer.byteLength(JSON.stringify(contentDocument), 'utf8'),
          );

          return {
            data: {
              chapterId: chapter.id,
              storyId: chapter.story.id,
              storySlug: chapter.story.slug,
              storyTitle: chapter.story.title,
              chapterNumber: chapter.number,
              chapterTitle: chapter.title,
              chapterSlug: chapter.slug,
              chapterVersion: chapter.version,
              content: chapter.content,
              contentFormat: chapter.contentFormat,
              contentDocument: toPrismaJson(contentDocument),
              documentSchemaVersion: contentDocument.schemaVersion,
              wordCount: chapter.wordCount,
              publishedAt: chapter.publishedAt,
              accessType,
              accessState:
                decision.accessState === 'FREE'
                  ? OfflineChapterAccessState.FREE
                  : OfflineChapterAccessState.ENTITLED,
              priceCredits: decision.priceCredits,
              entitlementId: decision.entitlementId,
              contentSizeBytes,
              mediaCount: media.mediaCount,
              mediaSnapshot: media.snapshot,
              snapshotAt: input.now,
            },
            sizeBytes: contentSizeBytes + media.totalSizeBytes,
            mediaAssetIds: media.mediaAssetIds,
          };
        });
        const totalSizeBytes = snapshots.reduce(
          (total, snapshot) => total + snapshot.sizeBytes,
          0n,
        );
        const mediaAssetIds = [
          ...new Set(snapshots.flatMap((snapshot) => snapshot.mediaAssetIds)),
        ];
        const violation = OfflinePackagePolicy.quotaViolation(
          quota,
          totalSizeBytes,
        );
        if (violation) throw new OfflineQuotaExceededException(violation);

        return tx.offlinePackage.create({
          data: {
            userId: input.userId,
            sessionId: input.sessionId,
            deviceId: session.device_id,
            name: input.name,
            description: input.description,
            status: OfflinePackageStatus.READY,
            totalSizeBytes,
            chapterCount: snapshots.length,
            licenseExpiresAt: OfflinePackagePolicy.licenseExpiresAt(input.now),
            lastAccessedAt: input.now,
            autoDeleteAt: OfflinePackagePolicy.autoDeleteAt(input.now),
            chapters: {
              create: snapshots.map((snapshot) => snapshot.data),
            },
            mediaPins: {
              create: mediaAssetIds.map((mediaAssetId) => ({ mediaAssetId })),
            },
          },
          select: PACKAGE_SUMMARY_SELECT,
        });
      }, transactionOptions());

      return mapPackageSummary(row);
    } catch (error: unknown) {
      rethrow(error, 'offline-create-package');
    }
  }

  async listPackages(
    userId: string,
    now: Date,
  ): Promise<readonly OfflinePackageSummaryDto[]> {
    try {
      const rows = await this.prisma.$transaction(async (tx) => {
        await lockUserPackages(tx, userId);
        await lockAndRefreshQuota(tx, userId, now);
        return tx.offlinePackage.findMany({
          where: { userId },
          orderBy: [{ lastAccessedAt: 'desc' }, { id: 'desc' }],
          select: PACKAGE_SUMMARY_SELECT,
        });
      }, transactionOptions());
      return rows.map(mapPackageSummary);
    } catch (error: unknown) {
      rethrow(error, 'offline-list-packages');
    }
  }

  async getQuota(userId: string, now: Date): Promise<OfflineQuotaDto> {
    try {
      const quota = await this.prisma.$transaction(async (tx) => {
        await lockUserPackages(tx, userId);
        return lockAndRefreshQuota(tx, userId, now);
      }, transactionOptions());
      return mapQuota(quota);
    } catch (error: unknown) {
      rethrow(error, 'offline-get-quota');
    }
  }

  async getManifest(
    input: SessionBoundOfflinePackageInput,
  ): Promise<OfflinePackageManifestDto> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        await lockOwnedPackage(tx, input.userId, input.packageId);
        const current = await tx.offlinePackage.findFirst({
          where: { id: input.packageId, userId: input.userId },
          select: PACKAGE_MANIFEST_SELECT,
        });
        assertManifestAccessible(
          current,
          input.sessionId,
          input.now,
          input.packageId,
        );

        const lastAccessedAt = input.now;
        const autoDeleteAt = OfflinePackagePolicy.autoDeleteAt(input.now);
        await tx.offlinePackage.update({
          where: { id: current.id },
          data: { lastAccessedAt, autoDeleteAt },
        });
        return { ...current, lastAccessedAt, autoDeleteAt };
      }, transactionOptions());

      return mapManifest(row, this.mediaUrl);
    } catch (error: unknown) {
      rethrow(error, 'offline-get-manifest');
    }
  }

  async deletePackage(input: OwnedOfflinePackageInput): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await lockOwnedPackage(tx, input.userId, input.packageId);
        const deleted = await tx.offlinePackage.deleteMany({
          where: { id: input.packageId, userId: input.userId },
        });
        if (deleted.count !== 1) {
          throw new OfflinePackageNotFoundException(input.packageId);
        }
      }, transactionOptions());
    } catch (error: unknown) {
      rethrow(error, 'offline-delete-package');
    }
  }

  async touchPackage(
    input: SessionBoundOfflinePackageInput,
  ): Promise<TouchOfflinePackageResultDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockOwnedPackage(tx, input.userId, input.packageId);
        const current = await tx.offlinePackage.findFirst({
          where: { id: input.packageId, userId: input.userId },
          select: {
            id: true,
            sessionId: true,
            status: true,
            licenseExpiresAt: true,
          },
        });
        assertManifestAccessible(
          current,
          input.sessionId,
          input.now,
          input.packageId,
        );

        const lastAccessedAt = input.now;
        const autoDeleteAt = OfflinePackagePolicy.autoDeleteAt(input.now);
        await tx.offlinePackage.update({
          where: { id: current.id },
          data: { lastAccessedAt, autoDeleteAt },
        });
        return { lastAccessedAt, autoDeleteAt };
      }, transactionOptions());
    } catch (error: unknown) {
      rethrow(error, 'offline-touch-package');
    }
  }
}

async function lockActiveSession(
  tx: Prisma.TransactionClient,
  input: Pick<CreateOfflinePackageInput, 'sessionId' | 'userId' | 'now'>,
): Promise<{ id: string; device_id: string | null }> {
  const rows = await tx.$queryRaw<
    Array<{ id: string; device_id: string | null }>
  >(
    Prisma.sql`
      SELECT "id", "device_id"
      FROM "sessions"
      WHERE "id" = ${input.sessionId}::uuid
        AND "user_id" = ${input.userId}::uuid
        AND "revoked_at" IS NULL
        AND "expires_at" > ${input.now}
      FOR SHARE
    `,
  );
  const session = rows[0];
  if (!session) {
    throw new AuthenticationRequiredException({
      code: 'OFFLINE_SESSION_INVALID',
      message: 'Phiên đăng nhập không còn hợp lệ để tạo gói offline',
    });
  }
  return session;
}

async function lockChapterSources(
  tx: Prisma.TransactionClient,
  chapterIds: readonly string[],
  userId: string,
): Promise<void> {
  const ids = uuidList(chapterIds);
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "chapters"
    WHERE "id" IN (${ids}) ORDER BY "id" FOR SHARE
  `);
  await tx.$queryRaw(Prisma.sql`
    SELECT "chapter_id" FROM "chapter_monetization"
    WHERE "chapter_id" IN (${ids}) ORDER BY "chapter_id" FOR SHARE
  `);
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "chapter_entitlements"
    WHERE "user_id" = ${userId}::uuid AND "chapter_id" IN (${ids})
    ORDER BY "id" FOR SHARE
  `);
  await tx.$queryRaw(Prisma.sql`
    SELECT asset."id"
    FROM "media_assets" AS asset
    INNER JOIN "chapter_media" AS link
      ON link."media_asset_id" = asset."id"
    WHERE link."chapter_id" IN (${ids})
    ORDER BY asset."id"
    FOR SHARE OF asset, link
  `);
}

async function loadChapterSources(
  tx: Prisma.TransactionClient,
  chapterIds: readonly string[],
  userId: string,
) {
  return tx.chapter.findMany({
    where: {
      id: { in: [...chapterIds] },
      status: ChapterStatus.PUBLISHED,
      deletedAt: null,
      publishedAt: { not: null },
      story: {
        visibility: StoryVisibility.PUBLIC,
        status: {
          in: [
            StoryStatus.PUBLISHED,
            StoryStatus.HIATUS,
            StoryStatus.COMPLETED,
          ],
        },
        deletedAt: null,
        publishedAt: { not: null },
      },
    },
    select: {
      id: true,
      number: true,
      title: true,
      slug: true,
      content: true,
      contentDocument: true,
      contentFormat: true,
      wordCount: true,
      version: true,
      publishedAt: true,
      story: { select: { id: true, slug: true, title: true } },
      monetization: {
        select: { accessType: true, creditPrice: true },
      },
      entitlements: {
        where: { userId },
        take: 1,
        select: {
          id: true,
          status: true,
          purchase: { select: { status: true } },
        },
      },
      media: {
        where: {
          mediaAsset: { status: MediaStatus.READY, deletedAt: null },
        },
        orderBy: { sortOrder: 'asc' },
        select: {
          mediaAssetId: true,
          sortOrder: true,
          altText: true,
          caption: true,
          mediaAsset: {
            select: {
              publicId: true,
              width: true,
              height: true,
              resourceType: true,
              deliveryType: true,
              sizeBytes: true,
            },
          },
          slices: {
            where: { processingStatus: MediaSliceStatus.READY },
            orderBy: { sliceIndex: 'asc' },
            select: {
              id: true,
              sliceIndex: true,
              width: true,
              height: true,
              offsetY: true,
              aspectRatio: true,
            },
          },
        },
      },
    },
  });
}

async function lockUserPackages(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "offline_packages"
    WHERE "user_id" = ${userId}::uuid ORDER BY "id" FOR UPDATE
  `);
}

async function lockOwnedPackage(
  tx: Prisma.TransactionClient,
  userId: string,
  packageId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "offline_packages"
    WHERE "id" = ${packageId}::uuid AND "user_id" = ${userId}::uuid
    FOR UPDATE
  `);
  if (!rows[0]) throw new OfflinePackageNotFoundException(packageId);
}

async function lockAndRefreshQuota(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
) {
  await tx.offlineQuota.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  await tx.$queryRaw(Prisma.sql`
    SELECT "user_id" FROM "offline_quotas"
    WHERE "user_id" = ${userId}::uuid FOR UPDATE
  `);
  await tx.offlinePackage.updateMany({
    where: {
      userId,
      status: OfflinePackageStatus.READY,
      licenseExpiresAt: { lte: now },
    },
    data: { status: OfflinePackageStatus.EXPIRED },
  });
  await tx.offlinePackage.deleteMany({
    where: { userId, autoDeleteAt: { lte: now } },
  });
  await tx.$queryRaw(Prisma.sql`
    SELECT reconcile_offline_quota_usage(${userId}::uuid)
  `);
  const quota = await tx.offlineQuota.findUnique({ where: { userId } });
  if (!quota) {
    throw new AuthenticationRequiredException({
      code: 'OFFLINE_USER_INVALID',
      message: 'Tài khoản không còn hợp lệ',
    });
  }
  return quota;
}

interface AccessiblePackageRow {
  id: string;
  sessionId: string | null;
  status: OfflinePackageStatus;
  licenseExpiresAt: Date;
}

export function assertManifestAccessible<
  PackageRow extends AccessiblePackageRow,
>(
  row: PackageRow | null,
  sessionId: string,
  now: Date,
  packageId: string,
): asserts row is PackageRow {
  if (!row) throw new OfflinePackageNotFoundException(packageId);
  if (row.sessionId !== sessionId) {
    throw new OfflinePackageSessionMismatchException();
  }
  if (row.licenseExpiresAt <= now) {
    throw new OfflinePackageUnavailableException('EXPIRED');
  }
  if (row.status !== OfflinePackageStatus.READY) {
    throw new OfflinePackageUnavailableException(row.status);
  }
}

function mapPackageSummary(row: PackageSummaryRow): OfflinePackageSummaryDto {
  return { ...row, totalSizeBytes: row.totalSizeBytes.toString() };
}

function mapQuota(
  quota: Awaited<ReturnType<typeof lockAndRefreshQuota>>,
): OfflineQuotaDto {
  return {
    maxPackages: quota.maxPackages,
    maxTotalSizeBytes: quota.maxTotalSizeBytes.toString(),
    maxChaptersPerPackage: quota.maxChaptersPerPackage,
    currentPackages: quota.currentPackages,
    currentSizeBytes: quota.currentSizeBytes.toString(),
    remainingPackages: Math.max(0, quota.maxPackages - quota.currentPackages),
    remainingSizeBytes: maxBigInt(
      0n,
      quota.maxTotalSizeBytes - quota.currentSizeBytes,
    ).toString(),
  };
}

function mapManifest(
  row: PackageManifestRow,
  mediaUrl: MediaUrlPort,
): OfflinePackageManifestDto {
  return {
    packageId: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    licenseExpiresAt: row.licenseExpiresAt,
    createdAt: row.createdAt,
    totalSizeBytes: row.totalSizeBytes.toString(),
    chapterCount: row.chapterCount,
    chapters: row.chapters.map((chapter) => {
      const accessState =
        chapter.accessState === OfflineChapterAccessState.FREE
          ? ('FREE' as const)
          : ('ENTITLED' as const);
      return {
        chapterId: chapter.chapterId,
        story: {
          id: chapter.storyId,
          slug: chapter.storySlug,
          title: chapter.storyTitle,
        },
        number: chapter.chapterNumber.toNumber(),
        title: chapter.chapterTitle,
        slug: chapter.chapterSlug,
        chapterVersion: chapter.chapterVersion,
        content: chapter.content,
        contentFormat: chapter.contentFormat,
        contentDocument:
          chapter.contentDocument as unknown as ChapterContentDocument,
        documentSchemaVersion: chapter.documentSchemaVersion,
        access: {
          type:
            chapter.accessType === ChapterAccessType.FREE
              ? ('FREE' as const)
              : ('PAID' as const),
          state: accessState,
          priceCredits: chapter.priceCredits?.toString() ?? null,
          entitlementId: chapter.entitlementId,
        },
        media: mapOfflineMediaSnapshot(
          chapter.mediaSnapshot,
          accessState,
          mediaUrl,
        ),
        wordCount: chapter.wordCount,
        publishedAt: chapter.publishedAt,
        snapshotAt: chapter.snapshotAt,
      };
    }),
  };
}

function normalizeContentDocument(
  value: unknown,
  content: string,
  chapterId: string,
): ChapterContentDocument {
  return isChapterContentDocument(value)
    ? value
    : createBackfilledChapterContentDocument(content, chapterId);
}

function toPrismaJson(value: ChapterContentDocument): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function uuidList(ids: readonly string[]): Prisma.Sql {
  return Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));
}

function transactionOptions(): {
  isolationLevel: Prisma.TransactionIsolationLevel;
  maxWait: number;
  timeout: number;
} {
  return {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5_000,
    timeout: 30_000,
  };
}

function maxBigInt(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}

function rethrow(error: unknown, operation: string): never {
  if (error instanceof AppException) throw error;
  throw mapPrismaError(error, { operation, resource: 'Gói đọc offline' });
}
