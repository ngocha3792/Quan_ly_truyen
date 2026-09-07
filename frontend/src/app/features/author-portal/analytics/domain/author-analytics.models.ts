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
  readonly readingStartRate: number | null;
  readonly averageReadingSecondsPerReaderDay: number | null;
}

export interface AnalyticsSeriesPoint extends AnalyticsTotals {
  readonly date: string;
}

export interface AnalyticsDataAvailability {
  readonly requestedDays: number;
  readonly recordedDays: number;
  readonly unrecordedDays: number;
  readonly lastAggregatedAt: string | null;
  readonly seriesMode: 'recorded_days_only';
  readonly audienceMetric: 'sum_of_story_daily_unique_readers';
}

export interface AuthorAnalyticsOverview {
  readonly range: AnalyticsRange;
  readonly totals: AnalyticsTotals;
  readonly series: readonly AnalyticsSeriesPoint[];
  readonly dataAvailability: AnalyticsDataAvailability;
  readonly freshness: string;
}

export interface StoryAnalyticsListItem extends AnalyticsTotals {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly recordedDays: number;
  readonly lastAggregatedAt: string | null;
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
  readonly dataAvailability: AnalyticsDataAvailability;
  readonly chapters: readonly ChapterAnalyticsItem[];
}
