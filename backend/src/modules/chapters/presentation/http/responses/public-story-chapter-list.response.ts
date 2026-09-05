import type { PublicStoryChapterListDto } from '../../../application';

export interface PublicStoryChapterListItemResponse {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly publishedAt: string;
}

export interface PublicStoryChapterListResponse {
  readonly items: readonly PublicStoryChapterListItemResponse[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

export function toPublicStoryChapterListResponse(
  result: PublicStoryChapterListDto,
): PublicStoryChapterListResponse {
  return {
    items: result.items.map((item) => ({
      ...item,
      publishedAt: item.publishedAt.toISOString(),
    })),
    pagination: { ...result.pagination },
  };
}
