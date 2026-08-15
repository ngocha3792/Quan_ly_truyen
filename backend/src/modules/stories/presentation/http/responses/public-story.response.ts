import type {
  PublicStoryDto,
  PublicStoryPageDto,
} from '../../../application';

export interface PublicStoryChapterSummaryResponse {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly publishedAt: string;
}

export interface PublicStoryResponse {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly synopsis: string;
  readonly languageCode: string;
  readonly contentRating: string;
  readonly releaseYear: number | null;
  readonly status: 'ONGOING' | 'HIATUS' | 'COMPLETED';
  readonly author: {
    readonly id: string;
    readonly penName: string;
    readonly slug: string;
  };
  readonly coverUrl: string | null;
  readonly categories: readonly {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly isPrimary: boolean;
  }[];
  readonly tags: readonly {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  }[];
  readonly latestChapter: PublicStoryChapterSummaryResponse | null;
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

export interface PublicStoryPageResponse {
  readonly items: readonly PublicStoryResponse[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

export function toPublicStoryResponse(
  result: PublicStoryDto,
): PublicStoryResponse {
  return {
    id: result.id,
    slug: result.slug,
    title: result.title,
    synopsis: result.synopsis,
    languageCode: result.languageCode,
    contentRating: result.contentRating,
    releaseYear: result.releaseYear,
    status: result.status,
    author: { ...result.author },
    coverUrl: result.coverUrl,
    categories: result.categories.map((category) => ({ ...category })),
    tags: result.tags.map((tag) => ({ ...tag })),
    latestChapter: result.latestChapter
      ? {
          ...result.latestChapter,
          publishedAt: result.latestChapter.publishedAt.toISOString(),
        }
      : null,
    stats: { ...result.stats },
    publishedAt: result.publishedAt?.toISOString() ?? null,
    lastChapterAt: result.lastChapterAt?.toISOString() ?? null,
    updatedAt: result.updatedAt.toISOString(),
  };
}

export function toPublicStoryPageResponse(
  result: PublicStoryPageDto,
): PublicStoryPageResponse {
  return {
    items: result.items.map((story) => toPublicStoryResponse(story)),
    pagination: { ...result.pagination },
  };
}
