import type { StoryResultDto } from '../../../application';

export interface StoryResponse {
  readonly id: string;

  readonly authorId: string;

  readonly title: string;

  readonly slug: string;

  readonly synopsis: string;

  readonly languageCode: string;

  readonly status: string;

  readonly visibility: string;

  readonly contentRating: string;

  readonly version: number;

  readonly createdAt: string;

  readonly updatedAt: string;
}

export function toStoryResponse(result: StoryResultDto): StoryResponse {
  return {
    id: result.id,
    authorId: result.authorId,
    title: result.title,
    slug: result.slug,
    synopsis: result.synopsis,
    languageCode: result.languageCode,
    status: result.status,
    visibility: result.visibility,
    contentRating: result.contentRating,
    version: result.version,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}
