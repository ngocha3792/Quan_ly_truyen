export type StoryUpdatesTab = 'all' | 'latest' | 'following' | 'hot' | 'completed';

export type StoryUpdatesSort = 'latest' | 'views' | 'title';

export type StoryPublicationStatus = 'ongoing' | 'completed';

export type StoryUpdateBadge = 'featured' | 'hot' | 'new' | null;

export type StoryUpdateStatTone = 'purple' | 'blue' | 'pink' | 'orange';

export interface StoryUpdateGenre {
  readonly slug: string;
  readonly name: string;
}

export interface StoryUpdateItem {
  readonly id: string;
  readonly slug: string;

  readonly title: string;
  readonly description: string | null;

  readonly coverUrl: string;
  readonly bannerUrl: string | null;

  readonly genres: readonly StoryUpdateGenre[];

  readonly latestChapter: number | null;
  readonly previousChapter: number | null;

  readonly updatedAt: string;

  readonly viewCount: number;
  readonly commentCount: number;

  readonly status: StoryPublicationStatus;

  readonly badge: StoryUpdateBadge;

  readonly followed: boolean;
  readonly hot: boolean;
}

export interface StoryUpdateStat {
  readonly id: 'updated-stories' | 'chapters-today' | 'following' | 'average-speed';

  readonly label: string;
  readonly value: number;
  readonly valueSuffix: string | null;

  readonly comparisonText: string;
  readonly tone: StoryUpdateStatTone;
}

export interface StoryUpdateScheduleItem {
  readonly id: 'today' | 'tomorrow' | 'next-two-days';

  readonly label: string;
  readonly chapterCount: number;
}

export interface StoryUpdateGenreSummary {
  readonly slug: string;
  readonly name: string;
}

export interface StoryUpdatesPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface StoryUpdatesOverview {
  readonly featured: StoryUpdateItem | null;

  readonly items: readonly StoryUpdateItem[];

  readonly topUpdates: readonly StoryUpdateItem[];

  readonly stats: readonly StoryUpdateStat[];

  readonly schedule: readonly StoryUpdateScheduleItem[];

  readonly popularGenres: readonly StoryUpdateGenreSummary[];

  readonly pagination: StoryUpdatesPagination;

  readonly generatedAt: string;
}

export interface StoryUpdatesQuery {
  readonly tab: StoryUpdatesTab;
  readonly sort: StoryUpdatesSort;

  readonly page: number;
  readonly pageSize: number;
}

export const DEFAULT_STORY_UPDATES_QUERY: StoryUpdatesQuery = {
  tab: 'all',
  sort: 'latest',

  page: 1,
  pageSize: 8,
};

export const EMPTY_STORY_UPDATES_OVERVIEW: StoryUpdatesOverview = {
  featured: null,
  items: [],
  topUpdates: [],
  stats: [],
  schedule: [],
  popularGenres: [],

  pagination: {
    page: 1,
    pageSize: 8,
    totalItems: 0,
    totalPages: 1,
  },

  generatedAt: new Date(0).toISOString(),
};
