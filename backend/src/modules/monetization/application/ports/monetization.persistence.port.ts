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

export interface SetChapterMonetizationInput {
  readonly actorId: string;
  readonly storyId: string;
  readonly chapterId: string;
  readonly accessType: ChapterAccessTypeName;
  readonly priceBandId?: string;
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
}
