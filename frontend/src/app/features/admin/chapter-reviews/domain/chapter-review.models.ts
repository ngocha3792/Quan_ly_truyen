export type ReviewDecision = 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGES';
/** Một chương bị lô bỏ qua, kèm lý do đủ rõ để hiện thẳng cho người bấm. */
export interface SkippedBulkChapter {
  readonly chapterId: string;
  readonly number: number;
  readonly title: string;
  readonly code: string;
  readonly message: string;
}

export interface BulkChapterActionResult {
  readonly changed: readonly { readonly id: string }[];
  readonly skipped: readonly SkippedBulkChapter[];
  /** Còn bấy nhiêu chương chưa tới lượt vì vượt trần mỗi lần gọi. */
  readonly remaining: number;
}

export interface ChapterReviewItem {
  readonly chapter: {
    readonly id: string;
    readonly storyId: string;
    readonly title: string;
    readonly content: string;
    readonly version: number;
    readonly status: string;
    readonly updatedAt: string;
    readonly wordCount: number;
  };
  readonly storyTitle: string;
  readonly reviews: readonly {
    readonly id: string;
    readonly reviewerName: string;
    readonly reviewedVersion: number;
    readonly decision: string;
    readonly comment: string | null;
    readonly createdAt: string;
  }[];
}
export interface ChapterReviewPage {
  readonly items: readonly ChapterReviewItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}
