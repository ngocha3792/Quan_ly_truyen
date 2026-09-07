import type {
  ChapterMonetizationRecord,
  AdminChapterPurchasePageRecord,
  ChapterPurchasePageRecord,
  ChapterPurchaseRecord,
  MonetizationPriceBandRecord,
  UnlockChapterRecord,
  RefundChapterPurchaseRecord,
  RevenueAnalyticsRecord,
  RevenueDimensionRecord,
} from '../ports';
import type {
  ChapterMonetizationResultDto,
  AdminChapterPurchasePageResultDto,
  ChapterPurchasePageResultDto,
  ChapterPurchaseResultDto,
  PriceBandResultDto,
  UnlockChapterResultDto,
  RefundChapterPurchaseResultDto,
  RevenueAnalyticsResultDto,
  RevenueDimensionResultDto,
} from '../dto';

export function toPriceBandResult(
  record: MonetizationPriceBandRecord,
): PriceBandResultDto {
  return {
    ...record,
    creditPrice: record.creditPrice.toString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toChapterMonetizationResult(
  record: ChapterMonetizationRecord,
): ChapterMonetizationResultDto {
  return {
    ...record,
    creditPrice: record.creditPrice?.toString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toChapterPurchaseResult(
  record: ChapterPurchaseRecord,
): ChapterPurchaseResultDto {
  return {
    ...record,
    creditPrice: record.creditPrice.toString(),
    createdAt: record.createdAt.toISOString(),
    refundedAt: record.refundedAt?.toISOString() ?? null,
  };
}

export function toAdminChapterPurchasePageResult(
  record: AdminChapterPurchasePageRecord,
): AdminChapterPurchasePageResultDto {
  return {
    items: record.items.map((item) => ({
      ...toChapterPurchaseResult(item),
      userId: item.userId,
      userEmail: item.userEmail,
      userDisplayName: item.userDisplayName,
      authorId: item.authorId,
      authorName: item.authorName,
      refundedById: item.refundedById,
    })),
    pagination: {
      page: record.page,
      pageSize: record.pageSize,
      totalItems: record.total,
      totalPages: Math.ceil(record.total / record.pageSize),
    },
  };
}

export function toRefundChapterPurchaseResult(
  record: RefundChapterPurchaseRecord,
): RefundChapterPurchaseResultDto {
  return {
    purchase: toChapterPurchaseResult(record.purchase),
    walletBalance: record.walletBalance.toString(),
    replayed: record.replayed,
  };
}

export function toRevenueAnalyticsResult(
  record: RevenueAnalyticsRecord,
): RevenueAnalyticsResultDto {
  return {
    from: record.from?.toISOString() ?? null,
    to: record.to?.toISOString() ?? null,
    totals: toRevenueTotals(record.totals),
    byChapter: record.byChapter.map(toRevenueDimension),
    byStory: record.byStory.map(toRevenueDimension),
    byAuthor: record.byAuthor.map(toRevenueDimension),
  };
}

function toRevenueDimension(
  record: RevenueDimensionRecord,
): RevenueDimensionResultDto {
  return { ...record, ...toRevenueTotals(record) };
}

function toRevenueTotals(record: {
  purchaseCount: number;
  refundCount: number;
  grossCredits: bigint;
  refundedCredits: bigint;
  netCredits: bigint;
}) {
  return {
    purchaseCount: record.purchaseCount,
    refundCount: record.refundCount,
    grossCredits: record.grossCredits.toString(),
    refundedCredits: record.refundedCredits.toString(),
    netCredits: record.netCredits.toString(),
  };
}

export function toChapterPurchasePageResult(
  record: ChapterPurchasePageRecord,
): ChapterPurchasePageResultDto {
  return {
    items: record.items.map(toChapterPurchaseResult),
    pagination: {
      page: record.page,
      pageSize: record.pageSize,
      totalItems: record.total,
      totalPages: Math.ceil(record.total / record.pageSize),
    },
  };
}

export function toUnlockChapterResult(
  record: UnlockChapterRecord,
): UnlockChapterResultDto {
  return {
    purchase: toChapterPurchaseResult(record.purchase),
    walletBalance: record.walletBalance.toString(),
    replayed: record.replayed,
    alreadyOwned: record.alreadyOwned,
  };
}
