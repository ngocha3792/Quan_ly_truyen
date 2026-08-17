export interface ReadingHistoryStorySummaryDto {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly author: string;
  readonly coverUrl: string | null;
  readonly categories: readonly string[];
  readonly latestChapterNumber: number | null;
  readonly chapterCount: number;
}

export interface ReadingHistoryEntryResultDto {
  readonly story: ReadingHistoryStorySummaryDto;
  readonly currentChapter: {
    readonly id: string;
    readonly number: number;
    readonly title: string;
  } | null;
  readonly position: number;
  readonly progressPercent: number;
  readonly lastReadAt: string;
}
