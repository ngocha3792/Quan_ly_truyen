import type {
  ChapterAccessTypeName,
  ChapterPurchaseStatusName,
} from '../../domain';

export const MONETIZATION_PERSISTENCE_PORT = Symbol(
  'MONETIZATION_PERSISTENCE_PORT',
);

export interface MonetizationPriceBandRecord {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly creditPrice: bigint;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly updatedAt: Date;
}

export interface ChapterMonetizationRecord {
  readonly chapterId: string;
  readonly accessType: ChapterAccessTypeName;
  readonly priceBandId: string | null;
  readonly creditPrice: bigint | null;
  readonly previewContent: string | null;
  readonly unlockPolicy: 'PERMANENT_PAID' | 'EARLY_ACCESS';
  readonly freeAt: Date | null;
  readonly paidWindowDays: number | null;
  readonly version: number;
  readonly updatedAt: Date;
}

export interface ChapterPurchaseRecord {
  readonly id: string;
  readonly chapterId: string;
  readonly storyId: string;
  readonly storySlug: string;
  readonly storyTitle: string;
  readonly chapterNumber: number;
  readonly chapterTitle: string;
  readonly creditPrice: bigint;
  readonly status: ChapterPurchaseStatusName;
  readonly walletTransactionId: string;
  readonly entitlementId: string | null;
  readonly createdAt: Date;
  readonly refundedAt: Date | null;
  readonly refundReason: string | null;
  readonly refundWalletTransactionId: string | null;
}

export interface ChapterPurchasePageRecord {
  readonly items: readonly ChapterPurchaseRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface UnlockChapterRecord {
  readonly purchase: ChapterPurchaseRecord;
  readonly walletBalance: bigint;
  readonly replayed: boolean;
  readonly alreadyOwned: boolean;
}

export interface AdminChapterPurchaseRecord extends ChapterPurchaseRecord {
  readonly userId: string;
  readonly userEmail: string;
  readonly userDisplayName: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly refundedById: string | null;
}

export interface AdminChapterPurchasePageRecord {
  readonly items: readonly AdminChapterPurchaseRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface RefundChapterPurchaseRecord {
  readonly purchase: ChapterPurchaseRecord;
  readonly walletBalance: bigint;
  readonly replayed: boolean;
}

export interface RevenueDimensionRecord {
  readonly id: string;
  readonly label: string;
  readonly secondaryLabel: string | null;
  readonly purchaseCount: number;
  readonly refundCount: number;
  readonly grossCredits: bigint;
  readonly refundedCredits: bigint;
  readonly netCredits: bigint;
}

export interface RevenueAnalyticsRecord {
  readonly from: Date | null;
  readonly to: Date | null;
  readonly totals: Omit<
    RevenueDimensionRecord,
    'id' | 'label' | 'secondaryLabel'
  >;
  readonly byChapter: readonly RevenueDimensionRecord[];
  readonly byStory: readonly RevenueDimensionRecord[];
  readonly byAuthor: readonly RevenueDimensionRecord[];
}

export interface SetChapterMonetizationInput {
  readonly actorId: string;
  readonly storyId: string;
  readonly chapterId: string;
  readonly accessType: ChapterAccessTypeName;
  readonly priceBandId?: string;
  readonly unlockPolicy?: 'PERMANENT_PAID' | 'EARLY_ACCESS';
  readonly freeAt?: Date;
  readonly paidWindowDays?: number;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
}

export interface UpdatePriceBandInput {
  readonly actorId: string;
  readonly priceBandId: string;
  readonly label?: string;
  readonly creditPrice?: bigint;
  readonly isActive?: boolean;
  readonly sortOrder?: number;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
}

export interface UnlockChapterInput {
  readonly userId: string;
  readonly chapterId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
}

export interface RefundChapterPurchaseInput {
  readonly actorId: string;
  readonly purchaseId: string;
  readonly reason: string;
  readonly requestHash: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
}

export interface AdminPurchaseExplorerInput {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: ChapterPurchaseStatusName;
  readonly query?: string;
  readonly userId?: string;
  readonly storyId?: string;
  readonly authorId?: string;
  readonly from?: Date;
  readonly to?: Date;
}

export interface MonetizationPersistencePort {
  listPriceBands(
    activeOnly: boolean,
  ): Promise<readonly MonetizationPriceBandRecord[]>;
  getChapterMonetization(input: {
    actorId: string;
    storyId: string;
    chapterId: string;
  }): Promise<ChapterMonetizationRecord>;
  setChapterMonetization(
    input: SetChapterMonetizationInput,
  ): Promise<ChapterMonetizationRecord>;
  updatePriceBand(
    input: UpdatePriceBandInput,
  ): Promise<MonetizationPriceBandRecord>;
  unlockChapter(input: UnlockChapterInput): Promise<UnlockChapterRecord>;
  listPurchases(input: {
    userId: string;
    page: number;
    pageSize: number;
  }): Promise<ChapterPurchasePageRecord>;
  listAdminPurchases(
    input: AdminPurchaseExplorerInput,
  ): Promise<AdminChapterPurchasePageRecord>;
  refundChapterPurchase(
    input: RefundChapterPurchaseInput,
  ): Promise<RefundChapterPurchaseRecord>;
  getRevenueAnalytics(input: {
    from?: Date;
    to?: Date;
    limit: number;
  }): Promise<RevenueAnalyticsRecord>;
}
