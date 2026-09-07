import { createHash, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  AppException,
  IdempotencyConflictException,
} from '@/common/exceptions';
import {
  AccountStatus,
  ChapterAccessType,
  ChapterEntitlementStatus,
  ChapterPurchaseStatus,
  ChapterStatus,
  Prisma,
  StoryStatus,
  StoryVisibility,
  WalletCurrency,
  WalletSystemAccount,
  WalletTransactionType,
} from '@/generated/prisma/client';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';
import { WalletInsufficientFundsException } from '@/modules/wallets';

import type {
  ChapterMonetizationRecord,
  ChapterPurchasePageRecord,
  ChapterPurchaseRecord,
  MonetizationPersistencePort,
  MonetizationPriceBandRecord,
  SetChapterMonetizationInput,
  UnlockChapterInput,
  UnlockChapterRecord,
  UpdatePriceBandInput,
} from '../../application';
import {
  buildServerControlledPreview,
  ChapterNotPurchasableException,
  MonetizationResourceNotFoundException,
} from '../../domain';

const PRICE_BAND_SELECT = {
  id: true,
  code: true,
  label: true,
  creditPrice: true,
  isActive: true,
  sortOrder: true,
  updatedAt: true,
} satisfies Prisma.MonetizationPriceBandSelect;

const PURCHASE_SELECT = {
  id: true,
  chapterId: true,
  creditPrice: true,
  status: true,
  walletTransactionId: true,
  requestHash: true,
  createdAt: true,
  entitlement: { select: { id: true } },
  chapter: {
    select: {
      number: true,
      title: true,
      story: { select: { id: true, slug: true, title: true } },
    },
  },
} satisfies Prisma.ChapterPurchaseSelect;

type PriceBandRow = Prisma.MonetizationPriceBandGetPayload<{
  select: typeof PRICE_BAND_SELECT;
}>;
type PurchaseRow = Prisma.ChapterPurchaseGetPayload<{
  select: typeof PURCHASE_SELECT;
}>;

@Injectable()
export class PrismaMonetizationPersistence implements MonetizationPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async listPriceBands(
    activeOnly: boolean,
  ): Promise<readonly MonetizationPriceBandRecord[]> {
    try {
      const rows = await this.prisma.monetizationPriceBand.findMany({
        ...(activeOnly ? { where: { isActive: true } } : {}),
        orderBy: [{ sortOrder: 'asc' }, { creditPrice: 'asc' }],
        select: PRICE_BAND_SELECT,
      });
      return rows.map(toPriceBandRecord);
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'monetization-list-price-bands',
        resource: 'Price band',
      });
    }
  }

  async getChapterMonetization(input: {
    actorId: string;
    storyId: string;
    chapterId: string;
  }): Promise<ChapterMonetizationRecord> {
    try {
      const chapter = await this.prisma.chapter.findFirst({
        where: {
          id: input.chapterId,
          storyId: input.storyId,
          story: { authorId: input.actorId, deletedAt: null },
          deletedAt: null,
        },
        select: {
          id: true,
          updatedAt: true,
          monetization: {
            select: {
              chapterId: true,
              accessType: true,
              priceBandId: true,
              creditPrice: true,
              previewContent: true,
              version: true,
              updatedAt: true,
            },
          },
        },
      });
      if (!chapter) {
        throw new MonetizationResourceNotFoundException(
          'chương thuộc truyện của tác giả',
          input.chapterId,
        );
      }
      return (
        chapter.monetization ?? {
          chapterId: chapter.id,
          accessType: ChapterAccessType.FREE,
          priceBandId: null,
          creditPrice: null,
          previewContent: null,
          version: 0,
          updatedAt: chapter.updatedAt,
        }
      );
    } catch (error: unknown) {
      if (error instanceof AppException) throw error;
      throw mapPrismaError(error, {
        operation: 'monetization-get-chapter-pricing',
        resource: 'Cấu hình kiếm tiền chương',
      });
    }
  }

  async setChapterMonetization(
    input: SetChapterMonetizationInput,
  ): Promise<ChapterMonetizationRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtext('chapter-pricing:' || ${input.chapterId}))
        `);
        const chapter = await tx.chapter.findFirst({
          where: {
            id: input.chapterId,
            storyId: input.storyId,
            story: { authorId: input.actorId, deletedAt: null },
            deletedAt: null,
          },
          select: { id: true, content: true },
        });
        if (!chapter) {
          throw new MonetizationResourceNotFoundException(
            'chương thuộc truyện của tác giả',
            input.chapterId,
          );
        }

        const current = await tx.chapterMonetization.findUnique({
          where: { chapterId: chapter.id },
          select: { version: true },
        });
        const version = (current?.version ?? 0) + 1;
        const priceBand =
          input.accessType === 'PAID'
            ? await tx.monetizationPriceBand.findFirst({
                where: { id: input.priceBandId, isActive: true },
                select: PRICE_BAND_SELECT,
              })
            : null;
        if (input.accessType === 'PAID' && !priceBand) {
          throw new MonetizationResourceNotFoundException(
            'price band đang hoạt động',
            input.priceBandId,
          );
        }

        const previewContent =
          input.accessType === 'PAID'
            ? buildServerControlledPreview(chapter.content)
            : null;
        const creditPrice = priceBand?.creditPrice ?? null;
        const row = await tx.chapterMonetization.upsert({
          where: { chapterId: chapter.id },
          create: {
            chapterId: chapter.id,
            accessType: toPrismaAccessType(input.accessType),
            priceBandId: priceBand?.id ?? null,
            creditPrice,
            previewContent,
            version,
            updatedById: input.actorId,
          },
          update: {
            accessType: toPrismaAccessType(input.accessType),
            priceBandId: priceBand?.id ?? null,
            creditPrice,
            previewContent,
            version,
            updatedById: input.actorId,
          },
          select: {
            chapterId: true,
            accessType: true,
            priceBandId: true,
            creditPrice: true,
            previewContent: true,
            version: true,
            updatedAt: true,
          },
        });
        await tx.chapterPricingVersion.create({
          data: {
            chapterId: chapter.id,
            version,
            accessType: row.accessType,
            priceBandId: row.priceBandId,
            creditPrice: row.creditPrice,
            previewContent: row.previewContent,
            changedById: input.actorId,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: input.actorId,
            action: 'chapter.monetization.updated',
            entityType: 'chapter',
            entityId: chapter.id,
            newValues: {
              accessType: row.accessType,
              priceBandId: row.priceBandId,
              creditPrice: row.creditPrice?.toString() ?? null,
              version,
            },
            ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
            ...(input.userAgent ? { userAgent: input.userAgent } : {}),
            ...(input.requestId ? { requestId: input.requestId } : {}),
          },
        });
        return {
          ...row,
          accessType: row.accessType,
        };
      });
    } catch (error: unknown) {
      if (error instanceof AppException) throw error;
      throw mapPrismaError(error, {
        operation: 'monetization-set-chapter-pricing',
        resource: 'Cấu hình kiếm tiền chương',
      });
    }
  }

  async updatePriceBand(
    input: UpdatePriceBandInput,
  ): Promise<MonetizationPriceBandRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.monetizationPriceBand.findUnique({
          where: { id: input.priceBandId },
          select: PRICE_BAND_SELECT,
        });
        if (!current) {
          throw new MonetizationResourceNotFoundException(
            'price band',
            input.priceBandId,
          );
        }
        const updated = await tx.monetizationPriceBand.update({
          where: { id: input.priceBandId },
          data: {
            ...(input.label !== undefined ? { label: input.label } : {}),
            ...(input.creditPrice !== undefined
              ? { creditPrice: input.creditPrice }
              : {}),
            ...(input.isActive !== undefined
              ? { isActive: input.isActive }
              : {}),
            ...(input.sortOrder !== undefined
              ? { sortOrder: input.sortOrder }
              : {}),
          },
          select: PRICE_BAND_SELECT,
        });
        await tx.auditLog.create({
          data: {
            actorId: input.actorId,
            action: 'monetization.price-band.updated',
            entityType: 'monetization_price_band',
            entityId: current.id,
            oldValues: serializePriceBand(current),
            newValues: serializePriceBand(updated),
            ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
            ...(input.userAgent ? { userAgent: input.userAgent } : {}),
            ...(input.requestId ? { requestId: input.requestId } : {}),
          },
        });
        return toPriceBandRecord(updated);
      });
    } catch (error: unknown) {
      if (error instanceof AppException) throw error;
      throw mapPrismaError(error, {
        operation: 'monetization-update-price-band',
        resource: 'Price band',
      });
    }
  }

  async unlockChapter(input: UnlockChapterInput): Promise<UnlockChapterRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockPurchaseIdempotency(tx, input.idempotencyKey);
        const existing = await tx.chapterPurchase.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: PURCHASE_SELECT,
        });
        if (existing) {
          if (existing.requestHash !== input.requestHash) {
            throw new IdempotencyConflictException({
              key: input.idempotencyKey,
              existingRequestHash: existing.requestHash,
              currentRequestHash: input.requestHash,
            });
          }
          return {
            purchase: toPurchaseRecord(existing),
            walletBalance: await findWalletBalance(tx, input.userId),
            replayed: true,
            alreadyOwned: false,
          };
        }

        await lockWallet(tx, input.userId);
        const user = await tx.user.findFirst({
          where: {
            id: input.userId,
            status: AccountStatus.ACTIVE,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!user) {
          throw new MonetizationResourceNotFoundException(
            'tài khoản mua chương',
            input.userId,
          );
        }

        const owned = await tx.chapterEntitlement.findFirst({
          where: {
            userId: input.userId,
            chapterId: input.chapterId,
            status: ChapterEntitlementStatus.ACTIVE,
          },
          select: { purchase: { select: PURCHASE_SELECT } },
        });
        if (owned) {
          return {
            purchase: toPurchaseRecord(owned.purchase),
            walletBalance: await findWalletBalance(tx, input.userId),
            replayed: false,
            alreadyOwned: true,
          };
        }

        const chapter = await tx.chapter.findFirst({
          where: {
            id: input.chapterId,
            status: ChapterStatus.PUBLISHED,
            publishedAt: { not: null },
            deletedAt: null,
            story: {
              deletedAt: null,
              visibility: StoryVisibility.PUBLIC,
              publishedAt: { not: null },
              status: {
                in: [
                  StoryStatus.PUBLISHED,
                  StoryStatus.HIATUS,
                  StoryStatus.COMPLETED,
                ],
              },
            },
          },
          select: {
            id: true,
            story: {
              select: {
                authorId: true,
                contributors: {
                  where: { userId: input.userId, canEdit: true },
                  select: { userId: true },
                  take: 1,
                },
              },
            },
            monetization: {
              select: {
                accessType: true,
                priceBandId: true,
                creditPrice: true,
              },
            },
          },
        });
        if (!chapter) {
          throw new MonetizationResourceNotFoundException(
            'chương đã xuất bản',
            input.chapterId,
          );
        }
        if (
          chapter.story.authorId === input.userId ||
          chapter.story.contributors.length > 0
        ) {
          throw new ChapterNotPurchasableException(
            'Tác giả hoặc cộng tác viên đã có quyền đọc, không cần mua chương',
          );
        }
        const pricing = chapter.monetization;
        if (
          pricing?.accessType !== ChapterAccessType.PAID ||
          !pricing.creditPrice ||
          pricing.creditPrice <= 0n
        ) {
          throw new ChapterNotPurchasableException();
        }

        const wallet = await tx.wallet.upsert({
          where: {
            userId_currency: {
              userId: input.userId,
              currency: WalletCurrency.CREDIT,
            },
          },
          create: { userId: input.userId, currency: WalletCurrency.CREDIT },
          update: {},
          select: { id: true, balance: true },
        });
        if (wallet.balance < pricing.creditPrice) {
          throw new WalletInsufficientFundsException({
            available: wallet.balance,
            required: pricing.creditPrice,
          });
        }

        const purchaseId = randomUUID();
        const balanceAfter = wallet.balance - pricing.creditPrice;
        const walletTransaction = await tx.walletLedgerTransaction.create({
          data: {
            walletId: wallet.id,
            currency: WalletCurrency.CREDIT,
            type: WalletTransactionType.CHAPTER_PURCHASE,
            idempotencyKey: buildLedgerIdempotencyKey(input.idempotencyKey),
            requestHash: input.requestHash,
            referenceType: 'chapter_purchase',
            referenceId: purchaseId,
            walletAmount: -pricing.creditPrice,
            walletBalanceAfter: balanceAfter,
            metadata: { chapterId: input.chapterId },
            entries: {
              create: [
                {
                  walletId: wallet.id,
                  currency: WalletCurrency.CREDIT,
                  amount: -pricing.creditPrice,
                },
                {
                  systemAccount: WalletSystemAccount.PLATFORM_REVENUE,
                  currency: WalletCurrency.CREDIT,
                  amount: pricing.creditPrice,
                },
              ],
            },
          },
          select: { id: true },
        });
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: balanceAfter, version: { increment: 1 } },
        });
        const purchase = await tx.chapterPurchase.create({
          data: {
            id: purchaseId,
            userId: input.userId,
            chapterId: input.chapterId,
            priceBandId: pricing.priceBandId,
            creditPrice: pricing.creditPrice,
            status: ChapterPurchaseStatus.COMPLETED,
            walletTransactionId: walletTransaction.id,
            idempotencyKey: input.idempotencyKey,
            requestHash: input.requestHash,
            entitlement: {
              create: {
                userId: input.userId,
                chapterId: input.chapterId,
                status: ChapterEntitlementStatus.ACTIVE,
              },
            },
          },
          select: PURCHASE_SELECT,
        });
        await tx.auditLog.create({
          data: {
            actorId: input.userId,
            action: 'chapter.purchase.completed',
            entityType: 'chapter_purchase',
            entityId: purchase.id,
            newValues: {
              chapterId: input.chapterId,
              creditPrice: pricing.creditPrice.toString(),
              walletTransactionId: walletTransaction.id,
            },
            ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
            ...(input.userAgent ? { userAgent: input.userAgent } : {}),
            ...(input.requestId ? { requestId: input.requestId } : {}),
          },
        });
        return {
          purchase: toPurchaseRecord(purchase),
          walletBalance: balanceAfter,
          replayed: false,
          alreadyOwned: false,
        };
      });
    } catch (error: unknown) {
      if (error instanceof AppException) throw error;
      throw mapPrismaError(error, {
        operation: 'monetization-unlock-chapter',
        resource: 'Mua quyền đọc chương',
      });
    }
  }

  async listPurchases(input: {
    userId: string;
    page: number;
    pageSize: number;
  }): Promise<ChapterPurchasePageRecord> {
    try {
      const where = {
        userId: input.userId,
      } satisfies Prisma.ChapterPurchaseWhereInput;
      const [rows, total] = await Promise.all([
        this.prisma.chapterPurchase.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: PURCHASE_SELECT,
        }),
        this.prisma.chapterPurchase.count({ where }),
      ]);
      return {
        items: rows.map(toPurchaseRecord),
        page: input.page,
        pageSize: input.pageSize,
        total,
      };
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'monetization-list-purchases-own',
        resource: 'Lịch sử mua chương',
      });
    }
  }
}

function toPriceBandRecord(row: PriceBandRow): MonetizationPriceBandRecord {
  return row;
}

function toPurchaseRecord(row: PurchaseRow): ChapterPurchaseRecord {
  return {
    id: row.id,
    chapterId: row.chapterId,
    storyId: row.chapter.story.id,
    storySlug: row.chapter.story.slug,
    storyTitle: row.chapter.story.title,
    chapterNumber: row.chapter.number.toNumber(),
    chapterTitle: row.chapter.title,
    creditPrice: row.creditPrice,
    status: row.status,
    walletTransactionId: row.walletTransactionId,
    entitlementId: row.entitlement?.id ?? null,
    createdAt: row.createdAt,
  };
}

function toPrismaAccessType(value: 'FREE' | 'PAID'): ChapterAccessType {
  return ChapterAccessType[value];
}

function serializePriceBand(row: PriceBandRow): Prisma.InputJsonValue {
  return {
    code: row.code,
    label: row.label,
    creditPrice: row.creditPrice.toString(),
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

async function lockPurchaseIdempotency(
  tx: Prisma.TransactionClient,
  idempotencyKey: string,
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext('chapter-purchase-idempotency:' || ${idempotencyKey}))
  `);
}

function buildLedgerIdempotencyKey(idempotencyKey: string): string {
  return `chapter-purchase:${createHash('sha256').update(idempotencyKey).digest('hex')}`;
}

async function lockWallet(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext('wallet:' || ${userId} || ':CREDIT'))
  `);
}

async function findWalletBalance(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<bigint> {
  const wallet = await tx.wallet.findUnique({
    where: {
      userId_currency: { userId, currency: WalletCurrency.CREDIT },
    },
    select: { balance: true },
  });
  return wallet?.balance ?? 0n;
}
