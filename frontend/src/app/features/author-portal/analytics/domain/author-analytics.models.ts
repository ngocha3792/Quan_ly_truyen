export interface AnalyticsRange {
  readonly from: string;
  readonly to: string;
  readonly timeZone: string;
}

export interface AnalyticsTotals {
  readonly views: number;
  readonly uniqueReaders: number;
  readonly readingStarts: number;
  readonly completions: number;
  readonly readingSeconds: number;
  readonly completionRate: number | null;
}

export interface AnalyticsSeriesPoint extends AnalyticsTotals {
  readonly date: string;
}

export interface AuthorAnalyticsOverview {
  readonly range: AnalyticsRange;
  readonly totals: AnalyticsTotals;
  readonly series: readonly AnalyticsSeriesPoint[];
  readonly freshness: string;
}

export interface StoryAnalyticsListItem extends AnalyticsTotals {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
}

export interface StoryAnalyticsList {
  readonly range: AnalyticsRange;
  readonly items: readonly StoryAnalyticsListItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

export interface ChapterAnalyticsItem extends AnalyticsTotals {
  readonly id: string;
  readonly number: number;
  readonly title: string;
}

export interface StoryAnalyticsDetail {
  readonly story: { readonly id: string; readonly title: string; readonly slug: string };
  readonly range: AnalyticsRange;
  readonly totals: AnalyticsTotals;
  readonly series: readonly AnalyticsSeriesPoint[];
  readonly chapters: readonly ChapterAnalyticsItem[];
}
