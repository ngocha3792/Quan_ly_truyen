export type PublicStoryStatus = 'ONGOING' | 'HIATUS' | 'COMPLETED';
export type PublicStorySort = 'latest' | 'popular' | 'rating' | 'chapter-count' | 'oldest';

export interface PublicStoryApiCategory {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly isPrimary: boolean;
}

export interface PublicStoryApiItem {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly synopsis: string;
  readonly languageCode: string;
  readonly contentRating: string;
  readonly releaseYear: number | null;
  readonly status: PublicStoryStatus;
  readonly author: {
    readonly id: string;
    readonly penName: string;
    readonly slug: string;
  };
  readonly coverUrl: string | null;
  readonly categories: readonly PublicStoryApiCategory[];
  readonly tags: readonly {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  }[];
  readonly latestChapter: {
    readonly id: string;
    readonly number: number;
    readonly title: string;
    readonly slug: string;
    readonly publishedAt: string;
  } | null;
  readonly stats: {
    readonly views: number;
    readonly followers: number;
    readonly ratingCount: number;
    readonly ratingAverage: number;
    readonly chapters: number;
    readonly comments: number;
  };
  readonly publishedAt: string | null;
  readonly lastChapterAt: string | null;
  readonly updatedAt: string;
}

export interface PublicStoryApiPage {
  readonly items: readonly PublicStoryApiItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

export type StoryRecommendationReasonApi =
  'FOLLOWED_AUTHOR' | 'PREFERRED_CATEGORY' | 'HIGH_RATING' | 'POPULAR';

export interface StoryRecommendationFeedApi {
  readonly personalized: boolean;
  readonly items: readonly {
    readonly story: PublicStoryApiItem;
    readonly reasonCode: StoryRecommendationReasonApi;
    readonly reason: string;
    readonly matchedCategories: readonly string[];
  }[];
}

export interface PublicStoryListParams {
  readonly q?: string;
  readonly genre?: string;
  readonly status?: 'ongoing' | 'completed' | 'hiatus';
  readonly sort?: PublicStorySort;
  readonly yearFrom?: number;
  readonly yearTo?: number;
  readonly page?: number;
  readonly pageSize?: number;
}

interface PublicChapterReaderChapterBaseApi {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly wordCount: number;
  readonly views: number;
  readonly comments: number;
  readonly publishedAt: string;
  readonly updatedAt: string;
}

export interface PublicUnlockedChapterReaderApi extends PublicChapterReaderChapterBaseApi {
  readonly access: {
    readonly state: 'FREE' | 'ENTITLED' | 'BYPASS';
    readonly priceCredits: string | null;
    readonly unlockPolicy?: 'PERMANENT_PAID' | 'EARLY_ACCESS';
    readonly freeAt?: string | null;
  };
  readonly content: string;
  readonly contentFormat: string;
  readonly contentDocument?: ChapterContentDocumentApi;
  readonly documentSchemaVersion?: number;
  readonly media?: readonly PublicChapterMediaApi[];
}

export interface PublicChapterMediaSliceApi {
  readonly id: string;
  readonly sliceIndex: number;
  readonly width: number;
  readonly height: number;
  readonly offsetY: number;
  readonly aspectRatio: number;
  readonly urls: { readonly avif: string; readonly webp: string; readonly jpeg: string };
}

export interface PublicChapterMediaApi {
  readonly mediaAssetId: string;
  readonly sortOrder: number;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly width: number;
  readonly height: number;
  readonly slices: readonly PublicChapterMediaSliceApi[];
}

export interface PublicLockedChapterReaderApi extends PublicChapterReaderChapterBaseApi {
  readonly access: {
    readonly state: 'LOCKED';
    readonly priceCredits: string;
    readonly unlockPolicy?: 'PERMANENT_PAID' | 'EARLY_ACCESS';
    readonly freeAt?: string | null;
  };
  readonly previewContent: string;
  readonly previewFormat: string;
}

export type PublicChapterReaderChapterApi =
  PublicUnlockedChapterReaderApi | PublicLockedChapterReaderApi;

export interface PublicChapterReaderApiResponse {
  readonly story: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
  };
  readonly chapter: PublicChapterReaderChapterApi;
  readonly navigation: {
    readonly previous: PublicChapterNavigationApiItem | null;
    readonly next: PublicChapterNavigationApiItem | null;
  };
}

export interface UnlockChapterApiResponse {
  readonly purchase: {
    readonly id: string;
    readonly chapterId: string;
    readonly creditPrice: string;
    readonly entitlementId: string | null;
  };
  readonly walletBalance: string;
  readonly replayed: boolean;
  readonly alreadyOwned: boolean;
}

export interface PublicChapterNavigationApiItem {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly publishedAt: string;
}

export interface PublicStoryChapterListApiItem {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly publishedAt: string;
}

export interface PublicStoryChapterListApiResponse {
  readonly items: readonly PublicStoryChapterListApiItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}
export interface ChapterContentBlockApi {
  readonly id: string;
  readonly type: 'paragraph' | 'heading' | 'blockquote' | 'list' | 'code' | 'horizontal_rule';
  readonly text: string;
  readonly marks: readonly {
    readonly type: 'bold' | 'italic' | 'code' | 'link';
    readonly from: number;
    readonly to: number;
    readonly href?: string;
  }[];
}

export interface ChapterContentDocumentApi {
  readonly schemaVersion: 1;
  readonly blocks: readonly ChapterContentBlockApi[];
}
