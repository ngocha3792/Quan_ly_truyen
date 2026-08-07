export type GenreTone =
  'red' | 'violet' | 'pink' | 'yellow' | 'purple' | 'orange' | 'gray' | 'blue' | 'cyan' | 'indigo';

export type GenreVisual =
  | 'action'
  | 'fantasy'
  | 'romance'
  | 'comedy'
  | 'manhwa'
  | 'manhua'
  | 'horror'
  | 'drama'
  | 'adventure'
  | 'school-life'
  | 'sci-fi'
  | 'isekai';

export interface GenreSummary {
  readonly id: string;
  readonly slug: string;

  readonly name: string;
  readonly description: string;

  readonly visual: GenreVisual;
  readonly tone: GenreTone;

  readonly storyCount: number;

  readonly coverUrl: string | null;
}

export interface GenreRankingItem {
  readonly id: string;
  readonly slug: string;
  readonly name: string;

  readonly storyCount: number;
  readonly rank: number;

  readonly tone: GenreTone;
}

export interface GenreTrendingItem {
  readonly id: string;
  readonly slug: string;
  readonly name: string;

  readonly coverUrl: string | null;

  readonly percent: number;
  readonly readingCount: number;

  readonly tone: GenreTone;
}

export interface GenreDiscoveryData {
  readonly genres: readonly GenreSummary[];

  readonly featured: readonly GenreSummary[];

  readonly ranking: readonly GenreRankingItem[];

  readonly trending: readonly GenreTrendingItem[];
}

export interface GenreDiscoveryQuery {
  readonly featuredLimit: number;
  readonly rankingLimit: number;
  readonly trendingLimit: number;

  readonly trendingPeriod: 'day' | 'week' | 'month';
}

export const DEFAULT_GENRE_DISCOVERY_QUERY: GenreDiscoveryQuery = {
  featuredLimit: 4,
  rankingLimit: 5,
  trendingLimit: 5,
  trendingPeriod: 'week',
};

export const EMPTY_GENRE_DISCOVERY_DATA: GenreDiscoveryData = {
  genres: [],
  featured: [],
  ranking: [],
  trending: [],
};
