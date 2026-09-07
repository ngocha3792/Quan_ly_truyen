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
