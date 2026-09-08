export type PaymentOrderStatus =
  | 'CREATED' | 'PENDING' | 'AWAITING_REVIEW' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED' | 'REVERSED';

export type ChapterPurchaseStatus = 'COMPLETED' | 'REFUNDED' | 'REVERSED';

export interface AdminPaymentOrder {
  readonly id: string;
  readonly userId: string;
  readonly userEmail: string;
  readonly userDisplayName: string;
  readonly packageLabel: string;
  readonly provider: string;
  readonly providerReference: string | null;
  readonly creditAmount: string;
  readonly fiatAmountMinor: string;
  readonly currency: string;
  readonly status: PaymentOrderStatus;
  readonly walletTransactionId: string | null;
  readonly failureCode: string | null;
  readonly createdAt: string;
  readonly settledAt: string | null;
}

export interface AdminChapterPurchase {
  readonly id: string;
  readonly userId: string;
  readonly userEmail: string;
  readonly userDisplayName: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly storyId: string;
  readonly storyTitle: string;
  readonly chapterId: string;
  readonly chapterNumber: number;
  readonly chapterTitle: string;
  readonly creditPrice: string;
  readonly status: ChapterPurchaseStatus;
  readonly walletTransactionId: string;
  readonly refundWalletTransactionId: string | null;
  readonly refundReason: string | null;
  readonly createdAt: string;
  readonly refundedAt: string | null;
}

export interface PageResult<T> {
  readonly items: readonly T[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

export interface RevenueDimension {
  readonly id: string;
  readonly label: string;
  readonly secondaryLabel: string | null;
  readonly purchaseCount: number;
  readonly refundCount: number;
  readonly grossCredits: string;
  readonly refundedCredits: string;
  readonly netCredits: string;
}

export interface RevenueAnalytics {
  readonly from: string | null;
  readonly to: string | null;
  readonly totals: Omit<RevenueDimension, 'id' | 'label' | 'secondaryLabel'>;
  readonly byChapter: readonly RevenueDimension[];
  readonly byStory: readonly RevenueDimension[];
  readonly byAuthor: readonly RevenueDimension[];
}
