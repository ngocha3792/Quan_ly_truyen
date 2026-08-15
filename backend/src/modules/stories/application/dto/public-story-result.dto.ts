export type PublicStoryPublicationStatus = 'ONGOING' | 'HIATUS' | 'COMPLETED';

export interface PublicStoryAuthorDto {
  readonly id: string;
  readonly penName: string;
  readonly slug: string;
}

export interface PublicStoryCategoryDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly isPrimary: boolean;
}

export interface PublicStoryTagDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface PublicStoryChapterSummaryDto {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly publishedAt: Date;
}

export interface PublicStoryStatsDto {
  readonly views: number;
  readonly followers: number;
  readonly ratingCount: number;
  readonly ratingAverage: number;
  readonly chapters: number;
  readonly comments: number;
}

export interface PublicStoryDto {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly synopsis: string;
  readonly languageCode: string;
  readonly contentRating: string;
  readonly releaseYear: number | null;
  readonly status: PublicStoryPublicationStatus;
  readonly author: PublicStoryAuthorDto;
  readonly coverUrl: string | null;
  readonly categories: readonly PublicStoryCategoryDto[];
  readonly tags: readonly PublicStoryTagDto[];
  readonly latestChapter: PublicStoryChapterSummaryDto | null;
  readonly stats: PublicStoryStatsDto;
  readonly publishedAt: Date | null;
  readonly lastChapterAt: Date | null;
  readonly updatedAt: Date;
}

export interface PublicStoryPaginationDto {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface PublicStoryPageDto {
  readonly items: readonly PublicStoryDto[];
  readonly pagination: PublicStoryPaginationDto;
}
