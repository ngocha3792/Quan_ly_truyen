export type StoryRankingPeriod = 'day' | 'week' | 'month' | 'all';

export type StoryRankingMetric = 'popular' | 'rating' | 'followers' | 'trending';

export type RankingTone = 'purple' | 'blue' | 'pink' | 'orange' | 'green';

export interface StoryRankingGenre {
  readonly slug: string;
  readonly name: string;
}

export interface StoryRankingItem {
  readonly id: string;
  readonly slug: string;

  readonly rank: number;
  readonly rankChange: number;

  readonly title: string;
  readonly authorName: string | null;

  readonly coverUrl: string;

  readonly genres: readonly StoryRankingGenre[];

  readonly latestChapter: number;

  readonly viewCount: number;

  readonly rating: number;
  readonly ratingCount: number;

  readonly followerCount: number;

  readonly popularityScore: number;
  readonly trendingScore: number;
}

export interface StoryRankingListResponse {
  readonly items: readonly StoryRankingItem[];

  readonly generatedAt: string;
}

export interface StoryRankingSummary {
  readonly totalReads: number;
  readonly totalReadsChangePercent: number;

  readonly hotStoryCount: number;
  readonly hotStoryChange: number;

  readonly followerCount: number;
  readonly followerChangePercent: number;
}

export interface GenreRankingDistribution {
  readonly slug: string;
  readonly name: string;

  readonly percentage: number;
  readonly tone: RankingTone;
}

export interface StoryRankingTrend {
  readonly id: string;
  readonly slug: string;
  readonly title: string;

  readonly coverUrl: string;

  readonly value: number;
  readonly maximumValue: number;
}

export interface StoryRankingOverview {
  readonly items: readonly StoryRankingItem[];

  readonly summary: StoryRankingSummary;

  readonly genres: readonly GenreRankingDistribution[];

  readonly trends: readonly StoryRankingTrend[];

  readonly generatedAt: string;
}

export interface StoryRankingQuery {
  readonly period: StoryRankingPeriod;

  readonly metric: StoryRankingMetric;

  readonly limit: number;
}

export const DEFAULT_STORY_RANKING_QUERY: StoryRankingQuery = {
  period: 'week',
  metric: 'popular',
  limit: 10,
};

export const EMPTY_STORY_RANKING_OVERVIEW: StoryRankingOverview = {
  items: [],

  summary: {
    totalReads: 0,
    totalReadsChangePercent: 0,

    hotStoryCount: 0,
    hotStoryChange: 0,

    followerCount: 0,
    followerChangePercent: 0,
  },

  genres: [],
  trends: [],

  generatedAt: new Date(0).toISOString(),
};
