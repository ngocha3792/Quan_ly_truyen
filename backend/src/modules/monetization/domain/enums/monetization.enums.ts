export const CHAPTER_ACCESS_TYPES = ['FREE', 'PAID'] as const;
export type ChapterAccessTypeName = (typeof CHAPTER_ACCESS_TYPES)[number];

export const CHAPTER_PURCHASE_STATUSES = [
  'COMPLETED',
  'REFUNDED',
  'REVERSED',
] as const;
export type ChapterPurchaseStatusName =
  (typeof CHAPTER_PURCHASE_STATUSES)[number];

export const CHAPTER_ENTITLEMENT_STATUSES = ['ACTIVE', 'REVOKED'] as const;
export type ChapterEntitlementStatusName =
  (typeof CHAPTER_ENTITLEMENT_STATUSES)[number];

export const MAX_CHAPTER_PRICE_CREDITS = 9_000_000_000_000_000n;
export const LOCKED_CHAPTER_PREVIEW_MAX_CHARS = 1_200;
