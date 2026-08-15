import type { ChapterSummaryResultDto } from '../../../application';

export interface ChapterSummaryResponse {
  readonly id: string;
  readonly storyId: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly status: string;
  readonly wordCount: number;
  readonly version: number;
  readonly scheduledAt: string | null;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toChapterSummaryResponse(
  result: ChapterSummaryResultDto,
): ChapterSummaryResponse {
  return {
    id: result.id,
    storyId: result.storyId,
    number: result.number,
    title: result.title,
    slug: result.slug,
    status: result.status,
    wordCount: result.wordCount,
    version: result.version,
    scheduledAt: result.scheduledAt?.toISOString() ?? null,
    publishedAt: result.publishedAt?.toISOString() ?? null,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}
