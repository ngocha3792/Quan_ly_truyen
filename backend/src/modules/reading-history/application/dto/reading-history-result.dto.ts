import type { ReadingCursor } from '../../domain';

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
  readonly cursor?: ReadingCursor | null;
  readonly revision: number;
  readonly deviceId: string | null;
  readonly clientEventId: string | null;
  readonly lastServerSequence: string;
  readonly progressPercent: number;
  readonly lastReadAt: string;
}
