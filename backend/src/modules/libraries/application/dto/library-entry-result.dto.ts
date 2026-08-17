export interface LibraryStorySummaryDto {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly author: string;
  readonly coverUrl: string | null;
  readonly categories: readonly string[];
  readonly latestChapterNumber: number | null;
  readonly chapterCount: number;
}

export interface LibraryEntryResultDto {
  readonly story: LibraryStorySummaryDto;
  readonly status: string;
  readonly isFavorite: boolean;
  readonly lastReadChapter: {
    readonly id: string;
    readonly number: number;
    readonly title: string;
  } | null;
  readonly progressPercent: number;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly updatedAt: string;
}
