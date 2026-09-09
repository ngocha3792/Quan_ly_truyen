export interface PriceBandResultDto {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly creditPrice: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly updatedAt: string;
}

export interface ChapterMonetizationResultDto {
  readonly chapterId: string;
  readonly accessType: 'FREE' | 'PAID';
  readonly priceBandId: string | null;
  readonly creditPrice: string | null;
  readonly previewContent: string | null;
  readonly unlockPolicy: 'PERMANENT_PAID' | 'EARLY_ACCESS';
  readonly freeAt: string | null;
  readonly paidWindowDays: number | null;
  readonly version: number;
  readonly updatedAt: string;
}

export interface ChapterPurchaseResultDto {
  readonly id: string;
  readonly chapterId: string;
  readonly storyId: string;
  readonly storySlug: string;
  readonly storyTitle: string;
  readonly chapterNumber: number;
  readonly chapterTitle: string;
  readonly creditPrice: string;
  readonly status: 'COMPLETED' | 'REFUNDED' | 'REVERSED';
  readonly walletTransactionId: string;
  readonly entitlementId: string | null;
  readonly createdAt: string;
  readonly refundedAt: string | null;
  readonly refundReason: string | null;
  readonly refundWalletTransactionId: string | null;
}

export interface ChapterPurchasePageResultDto {
  readonly items: readonly ChapterPurchaseResultDto[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

export interface UnlockChapterResultDto {
  readonly purchase: ChapterPurchaseResultDto;
  readonly walletBalance: string;
  readonly replayed: boolean;
  readonly alreadyOwned: boolean;
}

export interface AdminChapterPurchaseResultDto extends ChapterPurchaseResultDto {
  readonly userId: string;
  readonly userEmail: string;
  readonly userDisplayName: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly refundedById: string | null;
}

export interface AdminChapterPurchasePageResultDto {
  readonly items: readonly AdminChapterPurchaseResultDto[];
  readonly pagination: ChapterPurchasePageResultDto['pagination'];
}

export interface RefundChapterPurchaseResultDto {
  readonly purchase: ChapterPurchaseResultDto;
  readonly walletBalance: string;
  readonly replayed: boolean;
}

export interface RevenueDimensionResultDto {
  readonly id: string;
  readonly label: string;
  readonly secondaryLabel: string | null;
  readonly purchaseCount: number;
  readonly refundCount: number;
  readonly grossCredits: string;
  readonly refundedCredits: string;
  readonly netCredits: string;
}

export interface RevenueAnalyticsResultDto {
  readonly from: string | null;
  readonly to: string | null;
  readonly totals: Omit<
    RevenueDimensionResultDto,
    'id' | 'label' | 'secondaryLabel'
  >;
  readonly byChapter: readonly RevenueDimensionResultDto[];
  readonly byStory: readonly RevenueDimensionResultDto[];
  readonly byAuthor: readonly RevenueDimensionResultDto[];
}
