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

export interface PublicChapterReaderApiResponse {
  readonly story: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
  };
  readonly chapter: {
    readonly id: string;
    readonly number: number;
    readonly title: string;
    readonly slug: string;
    readonly content: string;
    readonly contentFormat: string;
    readonly wordCount: number;
    readonly views: number;
    readonly comments: number;
    readonly publishedAt: string;
    readonly updatedAt: string;
  };
  readonly navigation: {
    readonly previous: PublicChapterNavigationApiItem | null;
    readonly next: PublicChapterNavigationApiItem | null;
  };
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
