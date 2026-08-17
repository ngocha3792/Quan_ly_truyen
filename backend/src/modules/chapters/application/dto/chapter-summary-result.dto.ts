export interface ChapterSummaryResultDto {
  readonly id: string;
  readonly storyId: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly status: string;
  readonly wordCount: number;
  readonly version: number;
  readonly scheduledAt: Date | null;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
