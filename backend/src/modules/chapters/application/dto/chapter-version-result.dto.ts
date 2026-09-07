export interface ChapterVersionSummaryResultDto {
  readonly id: string;
  readonly chapterId: string;
  readonly createdById: string;
  readonly createdByDisplayName: string;
  readonly version: number;
  readonly title: string;
  readonly wordCount: number;
  readonly changeSummary: string | null;
  readonly createdAt: Date;
}

export interface ChapterVersionResultDto extends ChapterVersionSummaryResultDto {
  readonly content: string;
  readonly contentFormat: string;
}

export interface ChapterVersionPageResultDto {
  readonly items: readonly ChapterVersionSummaryResultDto[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}
