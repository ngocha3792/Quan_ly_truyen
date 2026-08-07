export type StoryPublicationStatus =
  | 'ongoing'
  | 'completed'
  | 'hiatus';

export type StoryCatalogSort =
  | 'latest'
  | 'popular'
  | 'rating'
  | 'chapter-count'
  | 'oldest';

export type StoryCatalogViewMode =
  | 'grid'
  | 'list';

export type StoryCatalogBadge =
  | 'HOT'
  | 'NEW'
  | 'FULL'
  | null;

export interface StoryGenre {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

export interface StoryGenreSummary {
  readonly slug: string;
  readonly name: string;
}

export interface StoryCatalogItem {
  readonly id: string;
  readonly slug: string;

  readonly title: string;
  readonly authorName: string | null;
  readonly description: string | null;

  readonly coverUrl: string;

  readonly genres:
  readonly StoryGenreSummary[];

  readonly status:
  StoryPublicationStatus;

  readonly badge:
  StoryCatalogBadge;

  readonly latestChapter: number;
  readonly chapterCount: number;

  readonly views: number;
  readonly rating: number;

  readonly releaseYear: number;
  readonly updatedAt: string;
}

export interface StoryRankingItem {
  readonly id: string;
  readonly slug: string;
  readonly title: string;

  readonly coverUrl: string;
  readonly genres:
  readonly StoryGenreSummary[];

  readonly views: number;
  readonly rating: number;
}

export interface StoryCatalogPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface StoryCatalogPage {
  readonly items:
  readonly StoryCatalogItem[];

  readonly pagination:
  StoryCatalogPagination;
}

export interface StoryCatalogQuery {
  readonly query: string;

  readonly genre:
  string | null;

  readonly status:
  StoryPublicationStatus | 'all';

  readonly sort:
  StoryCatalogSort;

  readonly yearFrom:
  number | null;

  readonly yearTo:
  number | null;

  readonly page: number;
  readonly pageSize: number;
}

export interface StoryCatalogFilter
  extends StoryCatalogQuery {
  readonly viewMode:
  StoryCatalogViewMode;
}

export interface StoryCatalogAdvancedFilter {
  readonly genre:
  string | null;

  readonly status:
  StoryPublicationStatus | 'all';

  readonly sort:
  StoryCatalogSort;

  readonly yearFrom:
  number | null;

  readonly yearTo:
  number | null;
}

export const DEFAULT_STORY_CATALOG_FILTER:
  StoryCatalogFilter = {
  query: '',

  genre: null,
  status: 'all',

  sort: 'latest',

  yearFrom: null,
  yearTo: null,

  page: 1,
  pageSize: 12,

  viewMode: 'grid',
};