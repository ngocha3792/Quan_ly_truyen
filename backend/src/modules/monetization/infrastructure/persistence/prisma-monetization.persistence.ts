import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import {
  AppException,
  IdempotencyConflictException,
} from '@/common/exceptions';
import { isChapterInMonetizationRollout, monetizationConfig } from '@/config';
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
import {
  MAX_WALLET_CREDIT_AMOUNT,
  WalletBalanceLimitExceededException,
} from '@/modules/wallets';
import { TransactionalReceiptService } from '@/modules/notifications';

import type {
  ChapterMonetizationRecord,
  AdminChapterPurchasePageRecord,
  AdminPurchaseExplorerInput,
  ChapterPurchasePageRecord,
  ChapterPurchaseRecord,
  MonetizationPersistencePort,
  MonetizationPriceBandRecord,
  SetChapterMonetizationInput,
  UnlockChapterInput,
  UnlockChapterRecord,
  RefundChapterPurchaseInput,
  RefundChapterPurchaseRecord,
  RevenueAnalyticsRecord,
  UpdatePriceBandInput,
} from '../../application';
import {
  buildServerControlledPreview,
  ChapterNotPurchasableException,
  ChapterPurchaseNotRefundableException,
  MonetizationRolloutRestrictedException,
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
  refundedAt: true,
  refundReason: true,
  refundWalletTransactionId: true,
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

const ADMIN_PURCHASE_SELECT = {
  ...PURCHASE_SELECT,
  userId: true,
  refundedById: true,
  user: { select: { email: true, displayName: true } },
  chapter: {
    select: {
      number: true,
      title: true,
      story: {
        select: {
          id: true,
          slug: true,
          title: true,
          authorId: true,
          author: { select: { penName: true } },
        },
      },
    },
  },
} satisfies Prisma.ChapterPurchaseSelect;

type AdminPurchaseRow = Prisma.ChapterPurchaseGetPayload<{
  select: typeof ADMIN_PURCHASE_SELECT;
}>;

interface RevenueRow {
  dimension: 'total' | 'chapter' | 'story' | 'author';
  id: string | null;
  label: string | null;
  secondaryLabel: string | null;
  purchaseCount: bigint;
  refundCount: bigint;
  grossCredits: bigint;
  refundedCredits: bigint;
  netCredits: bigint;
}

@Injectable()
export class PrismaMonetizationPersistence implements MonetizationPersistencePort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receipts: TransactionalReceiptService,
    @Inject(monetizationConfig.KEY)
    private readonly monetization: ConfigType<typeof monetizationConfig>,
  ) {}

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
              unlockPolicy: true,
              freeAt: true,
              paidWindowDays: true,
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
          unlockPolicy: 'PERMANENT_PAID',
          freeAt: null,
          paidWindowDays: null,
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
            unlockPolicy: input.unlockPolicy ?? 'PERMANENT_PAID',
            freeAt:
              input.unlockPolicy === 'EARLY_ACCESS'
                ? (input.freeAt ?? null)
                : null,
            paidWindowDays:
              input.unlockPolicy === 'EARLY_ACCESS'
                ? (input.paidWindowDays ?? null)
                : null,
            originalPriceCredits:
              input.unlockPolicy === 'EARLY_ACCESS' ? creditPrice : null,
            version,
            updatedById: input.actorId,
          },
          update: {
            accessType: toPrismaAccessType(input.accessType),
            priceBandId: priceBand?.id ?? null,
            creditPrice,
            previewContent,
            unlockPolicy: input.unlockPolicy ?? 'PERMANENT_PAID',
            freeAt:
              input.unlockPolicy === 'EARLY_ACCESS'
                ? (input.freeAt ?? null)
                : null,
            paidWindowDays:
              input.unlockPolicy === 'EARLY_ACCESS'
                ? (input.paidWindowDays ?? null)
                : null,
            originalPriceCredits:
              input.unlockPolicy === 'EARLY_ACCESS' ? creditPrice : null,
            version,
            updatedById: input.actorId,
          },
          select: {
            chapterId: true,
            accessType: true,
            priceBandId: true,
            creditPrice: true,
            previewContent: true,
            unlockPolicy: true,
            freeAt: true,
            paidWindowDays: true,
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
            unlockPolicy: row.unlockPolicy,
            freeAt: row.freeAt,
            paidWindowDays: row.paidWindowDays,
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
                id: true,
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
          !isChapterInMonetizationRollout({
            config: this.monetization,
            userId: input.userId,
            storyId: chapter.story.id,
          })
        ) {
          throw new MonetizationRolloutRestrictedException();
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
        const createdPurchase = await tx.chapterPurchase.create({
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
          },
          select: { id: true },
        });
        await tx.chapterEntitlement.upsert({
          where: {
            userId_chapterId: {
              userId: input.userId,
              chapterId: input.chapterId,
            },
          },
          create: {
            userId: input.userId,
            chapterId: input.chapterId,
            purchaseId: createdPurchase.id,
            status: ChapterEntitlementStatus.ACTIVE,
          },
          update: {
            purchaseId: createdPurchase.id,
            status: ChapterEntitlementStatus.ACTIVE,
            grantedAt: new Date(),
            revokedAt: null,
          },
        });
        const purchase = await tx.chapterPurchase.findUniqueOrThrow({
          where: { id: createdPurchase.id },
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
        await this.receipts.enqueue(tx, {
          userId: input.userId,
          dedupeKey: `chapter-purchase:${purchase.id}`,
          type: 'chapter_purchase',
          title: 'Mua chương thành công',
          body: `Bạn đã mở khóa ${purchase.chapter.story.title} — Chương ${purchase.chapter.number.toString()}: ${purchase.chapter.title}.`,
          tag: 'Mua chương',
          transactionId: walletTransaction.id,
          amountCredits: pricing.creditPrice,
          data: {
            purchaseId: purchase.id,
            chapterId: input.chapterId,
            storyId: purchase.chapter.story.id,
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

  async listAdminPurchases(
    input: AdminPurchaseExplorerInput,
  ): Promise<AdminChapterPurchasePageRecord> {
    try {
      const query = input.query?.trim();
      const where = {
        ...(input.status
          ? { status: ChapterPurchaseStatus[input.status] }
          : {}),
        ...(input.userId ? { userId: input.userId } : {}),
        ...(input.storyId || input.authorId
          ? {
              chapter: {
                ...(input.storyId ? { storyId: input.storyId } : {}),
                ...(input.authorId
                  ? { story: { authorId: input.authorId } }
                  : {}),
              },
            }
          : {}),
        ...(input.from || input.to
          ? {
              createdAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
        ...(query
          ? {
              OR: [
                ...(isUuid(query) ? [{ id: query }] : []),
                { user: { email: { contains: query, mode: 'insensitive' } } },
                {
                  user: {
                    displayName: { contains: query, mode: 'insensitive' },
                  },
                },
                {
                  chapter: {
                    story: { title: { contains: query, mode: 'insensitive' } },
                  },
                },
                {
                  chapter: { title: { contains: query, mode: 'insensitive' } },
                },
              ],
            }
          : {}),
      } satisfies Prisma.ChapterPurchaseWhereInput;
      const [rows, total] = await Promise.all([
        this.prisma.chapterPurchase.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: ADMIN_PURCHASE_SELECT,
        }),
        this.prisma.chapterPurchase.count({ where }),
      ]);
      return {
        items: rows.map(toAdminPurchaseRecord),
        page: input.page,
        pageSize: input.pageSize,
        total,
      };
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'monetization-list-admin-purchases',
        resource: 'Purchase explorer',
      });
    }
  }

  async refundChapterPurchase(
    input: RefundChapterPurchaseInput,
  ): Promise<RefundChapterPurchaseRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtext('chapter-refund:' || ${input.purchaseId}))
        `);
        const purchase = await tx.chapterPurchase.findUnique({
          where: { id: input.purchaseId },
          select: {
            ...PURCHASE_SELECT,
            userId: true,
            refundWalletTransaction: { select: { requestHash: true } },
          },
        });
        if (!purchase) {
          throw new MonetizationResourceNotFoundException(
            'giao dịch mua chương',
            input.purchaseId,
          );
        }
        if (purchase.status === ChapterPurchaseStatus.REFUNDED) {
          if (
            purchase.refundWalletTransaction?.requestHash !== input.requestHash
          ) {
            throw new IdempotencyConflictException({
              key: `chapter-refund:${input.purchaseId}`,
              existingRequestHash:
                purchase.refundWalletTransaction?.requestHash ?? 'missing',
              currentRequestHash: input.requestHash,
            });
          }
          return {
            purchase: toPurchaseRecord(purchase),
            walletBalance: await findWalletBalance(tx, purchase.userId),
            replayed: true,
          };
        }
        if (purchase.status !== ChapterPurchaseStatus.COMPLETED) {
          throw new ChapterPurchaseNotRefundableException(purchase.status);
        }

        await lockWallet(tx, purchase.userId);
        const wallet = await tx.wallet.findUnique({
          where: {
            userId_currency: {
              userId: purchase.userId,
              currency: WalletCurrency.CREDIT,
            },
          },
          select: { id: true, balance: true },
        });
        if (!wallet) {
          throw new MonetizationResourceNotFoundException(
            'ví Credit của người mua',
            purchase.userId,
          );
        }
        const balanceAfter = wallet.balance + purchase.creditPrice;
        if (balanceAfter > MAX_WALLET_CREDIT_AMOUNT) {
          throw new WalletBalanceLimitExceededException(
            MAX_WALLET_CREDIT_AMOUNT,
          );
        }
        const refundTransaction = await tx.walletLedgerTransaction.create({
          data: {
            walletId: wallet.id,
            currency: WalletCurrency.CREDIT,
            type: WalletTransactionType.REFUND,
            idempotencyKey: `chapter-refund:${purchase.id}`,
            requestHash: input.requestHash,
            referenceType: 'chapter_refund',
            referenceId: purchase.id,
            walletAmount: purchase.creditPrice,
            walletBalanceAfter: balanceAfter,
            metadata: { purchaseId: purchase.id, reason: input.reason },
            entries: {
              create: [
                {
                  walletId: wallet.id,
                  currency: WalletCurrency.CREDIT,
                  amount: purchase.creditPrice,
                },
                {
                  systemAccount: WalletSystemAccount.PLATFORM_REVENUE,
                  currency: WalletCurrency.CREDIT,
                  amount: -purchase.creditPrice,
                },
              ],
            },
          },
          select: { id: true },
        });
        const refundedAt = new Date();
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: balanceAfter, version: { increment: 1 } },
        });
        await tx.chapterEntitlement.updateMany({
          where: {
            purchaseId: purchase.id,
            status: ChapterEntitlementStatus.ACTIVE,
          },
          data: {
            status: ChapterEntitlementStatus.REVOKED,
            revokedAt: refundedAt,
          },
        });
        const updated = await tx.chapterPurchase.update({
          where: { id: purchase.id },
          data: {
            status: ChapterPurchaseStatus.REFUNDED,
            refundedAt,
            refundReason: input.reason,
            refundedById: input.actorId,
            refundWalletTransactionId: refundTransaction.id,
          },
          select: PURCHASE_SELECT,
        });
        await tx.auditLog.create({
          data: {
            actorId: input.actorId,
            action: 'chapter.purchase.refunded',
            entityType: 'chapter_purchase',
            entityId: purchase.id,
            oldValues: { status: purchase.status },
            newValues: {
              status: ChapterPurchaseStatus.REFUNDED,
              reason: input.reason,
              refundWalletTransactionId: refundTransaction.id,
              entitlementRevoked: true,
            },
            ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
            ...(input.userAgent ? { userAgent: input.userAgent } : {}),
            ...(input.requestId ? { requestId: input.requestId } : {}),
          },
        });
        await this.receipts.enqueue(tx, {
          userId: purchase.userId,
          dedupeKey: `chapter-refund:${purchase.id}`,
          type: 'chapter_refund',
          title: 'Hoàn Credit mua chương',
          body: `${purchase.creditPrice.toString()} Credit đã được hoàn cho ${purchase.chapter.story.title} — Chương ${purchase.chapter.number.toString()}.`,
          tag: 'Hoàn Credit',
          transactionId: refundTransaction.id,
          amountCredits: purchase.creditPrice,
          data: { purchaseId: purchase.id, chapterId: purchase.chapterId },
        });
        return {
          purchase: toPurchaseRecord(updated),
          walletBalance: balanceAfter,
          replayed: false,
        };
      });
    } catch (error: unknown) {
      if (error instanceof AppException) throw error;
      throw mapPrismaError(error, {
        operation: 'monetization-refund-chapter-purchase',
        resource: 'Hoàn giao dịch mua chương',
      });
    }
  }

  async getRevenueAnalytics(input: {
    from?: Date;
    to?: Date;
    limit: number;
  }): Promise<RevenueAnalyticsRecord> {
    try {
      const rows = await this.prisma.$queryRaw<RevenueRow[]>(Prisma.sql`
        WITH revenue_events AS (
          SELECT
            purchase.id AS purchase_id,
            chapter.id AS chapter_id,
            chapter.title AS chapter_title,
            chapter.number::text AS chapter_number,
            story.id AS story_id,
            story.title AS story_title,
            author.user_id AS author_id,
            author.pen_name AS author_name,
            ledger_transaction.type,
            entry.amount
          FROM wallet_ledger_transactions ledger_transaction
          INNER JOIN wallet_ledger_entries entry
            ON entry.transaction_id = ledger_transaction.id
           AND entry.system_account = 'platform_revenue'
          INNER JOIN chapter_purchases purchase
            ON purchase.id::text = ledger_transaction.reference_id
           AND ledger_transaction.reference_type IN ('chapter_purchase', 'chapter_refund')
          INNER JOIN chapters chapter ON chapter.id = purchase.chapter_id
          INNER JOIN stories story ON story.id = chapter.story_id
          INNER JOIN author_profiles author ON author.user_id = story.author_id
          WHERE ledger_transaction.type IN ('chapter_purchase', 'refund')
            ${input.from ? Prisma.sql`AND ledger_transaction.created_at >= ${input.from}` : Prisma.empty}
            ${input.to ? Prisma.sql`AND ledger_transaction.created_at <= ${input.to}` : Prisma.empty}
        )
        SELECT
          CASE
            WHEN GROUPING(chapter_id) = 0 THEN 'chapter'
            WHEN GROUPING(story_id) = 0 THEN 'story'
            WHEN GROUPING(author_id) = 0 THEN 'author'
            ELSE 'total'
          END AS dimension,
          CASE
            WHEN GROUPING(chapter_id) = 0 THEN chapter_id::text
            WHEN GROUPING(story_id) = 0 THEN story_id::text
            WHEN GROUPING(author_id) = 0 THEN author_id::text
            ELSE NULL
          END AS id,
          CASE
            WHEN GROUPING(chapter_id) = 0 THEN chapter_title
            WHEN GROUPING(story_id) = 0 THEN story_title
            WHEN GROUPING(author_id) = 0 THEN author_name
            ELSE 'Tổng'
          END AS label,
          CASE
            WHEN GROUPING(chapter_id) = 0 THEN story_title || ' · Chương ' || chapter_number
            WHEN GROUPING(story_id) = 0 THEN author_name
            ELSE NULL
          END AS "secondaryLabel",
          COUNT(DISTINCT purchase_id) FILTER (WHERE type = 'chapter_purchase')::bigint AS "purchaseCount",
          COUNT(DISTINCT purchase_id) FILTER (WHERE type = 'refund')::bigint AS "refundCount",
          COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0)::bigint AS "grossCredits",
          ABS(COALESCE(SUM(amount) FILTER (WHERE amount < 0), 0))::bigint AS "refundedCredits",
          COALESCE(SUM(amount), 0)::bigint AS "netCredits"
        FROM revenue_events
        GROUP BY GROUPING SETS (
          (chapter_id, chapter_title, chapter_number, story_title),
          (story_id, story_title, author_name),
          (author_id, author_name),
          ()
        )
        ORDER BY "netCredits" DESC
      `);
      const total = rows.find((row) => row.dimension === 'total');
      const mapDimension = (dimension: RevenueRow['dimension']) =>
        rows
          .filter((row) => row.dimension === dimension && row.id && row.label)
          .slice(0, input.limit)
          .map((row) => ({
            id: row.id!,
            label: row.label!,
            secondaryLabel: row.secondaryLabel,
            purchaseCount: Number(row.purchaseCount),
            refundCount: Number(row.refundCount),
            grossCredits: row.grossCredits,
            refundedCredits: row.refundedCredits,
            netCredits: row.netCredits,
          }));
      return {
        from: input.from ?? null,
        to: input.to ?? null,
        totals: {
          purchaseCount: Number(total?.purchaseCount ?? 0n),
          refundCount: Number(total?.refundCount ?? 0n),
          grossCredits: total?.grossCredits ?? 0n,
          refundedCredits: total?.refundedCredits ?? 0n,
          netCredits: total?.netCredits ?? 0n,
        },
        byChapter: mapDimension('chapter'),
        byStory: mapDimension('story'),
        byAuthor: mapDimension('author'),
      };
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'monetization-revenue-analytics',
        resource: 'Báo cáo doanh thu Credit',
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
    refundedAt: row.refundedAt,
    refundReason: row.refundReason,
    refundWalletTransactionId: row.refundWalletTransactionId,
  };
}

function toAdminPurchaseRecord(row: AdminPurchaseRow) {
  return {
    ...toPurchaseRecord(row),
    userId: row.userId,
    userEmail: row.user.email,
    userDisplayName: row.user.displayName,
    authorId: row.chapter.story.authorId,
    authorName: row.chapter.story.author.penName,
    refundedById: row.refundedById,
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value,
  );
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
