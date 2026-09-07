import type {
  ChapterVersionPageResultDto,
  ChapterVersionResultDto,
  ChapterVersionSummaryResultDto,
} from '../../../application';

export interface ChapterVersionSummaryResponse {
  readonly id: string;
  readonly chapterId: string;
  readonly createdById: string;
  readonly createdByDisplayName: string;
  readonly version: number;
  readonly title: string;
  readonly wordCount: number;
  readonly changeSummary: string | null;
  readonly createdAt: string;
}

export interface ChapterVersionResponse extends ChapterVersionSummaryResponse {
  readonly content: string;
  readonly contentFormat: string;
}

export interface ChapterVersionPageResponse {
  readonly items: readonly ChapterVersionSummaryResponse[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export function toChapterVersionPageResponse(
  result: ChapterVersionPageResultDto,
): ChapterVersionPageResponse {
  return {
    items: result.items.map(toChapterVersionSummaryResponse),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  };
}

export function toChapterVersionResponse(
  result: ChapterVersionResultDto,
): ChapterVersionResponse {
  return {
    ...toChapterVersionSummaryResponse(result),
    content: result.content,
    contentFormat: result.contentFormat,
  };
}

function toChapterVersionSummaryResponse(
  result: ChapterVersionSummaryResultDto,
): ChapterVersionSummaryResponse {
  return {
    id: result.id,
    chapterId: result.chapterId,
    createdById: result.createdById,
    createdByDisplayName: result.createdByDisplayName,
    version: result.version,
    title: result.title,
    wordCount: result.wordCount,
    changeSummary: result.changeSummary,
    createdAt: result.createdAt.toISOString(),
  };
}
