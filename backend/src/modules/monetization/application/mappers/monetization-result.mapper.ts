import type {
  ChapterMonetizationRecord,
  ChapterPurchasePageRecord,
  ChapterPurchaseRecord,
  MonetizationPriceBandRecord,
  UnlockChapterRecord,
} from '../ports';
import type {
  ChapterMonetizationResultDto,
  ChapterPurchasePageResultDto,
  ChapterPurchaseResultDto,
  PriceBandResultDto,
  UnlockChapterResultDto,
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
