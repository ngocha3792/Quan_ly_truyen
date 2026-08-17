import type { ChapterResultDto } from '../../../application';

export interface ChapterResponse {
  readonly id: string;

  readonly storyId: string;

  readonly createdById: string;

  readonly updatedById: string;

  readonly number: number;

  readonly title: string;

  readonly slug: string;

  readonly content: string;

  readonly contentFormat: string;

  readonly status: string;

  readonly wordCount: number;

  readonly version: number;

  readonly scheduledAt: string | null;

  readonly publishedAt: string | null;

  readonly createdAt: string;

  readonly updatedAt: string;
}

export function toChapterResponse(result: ChapterResultDto): ChapterResponse {
  return {
    id: result.id,
    storyId: result.storyId,
    createdById: result.createdById,
    updatedById: result.updatedById,
    number: result.number,
    title: result.title,
    slug: result.slug,
    content: result.content,
    contentFormat: result.contentFormat,
    status: result.status,
    wordCount: result.wordCount,
    version: result.version,
    scheduledAt: result.scheduledAt?.toISOString() ?? null,
    publishedAt: result.publishedAt?.toISOString() ?? null,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}
