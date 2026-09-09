export type ReviewDecision = 'APPROVED' | 'REJECTED' | 'REQUEST_CHANGES';
export interface ChapterReviewItem {
  readonly chapter: {
    readonly id: string;
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
