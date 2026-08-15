import type { StoryResultDto } from '../../../application';

export interface StoryCategoryResponse {
  readonly id: string;

  readonly name: string;

  readonly slug: string;

  readonly isPrimary: boolean;
}

export interface StoryTagResponse {
  readonly id: string;

  readonly name: string;

  readonly slug: string;
}

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

  readonly coverMediaId: string | null;

  readonly categories: readonly StoryCategoryResponse[];

  readonly tags: readonly StoryTagResponse[];

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
    coverMediaId: result.coverMediaId,
    categories: result.categories.map((category) => ({ ...category })),
    tags: result.tags.map((tag) => ({ ...tag })),
    version: result.version,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}
