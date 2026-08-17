import type {
  PublicChapterNavigationDto,
  PublicChapterReaderDto,
} from '../../../application';

export interface PublicChapterNavigationResponse {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly publishedAt: string;
}

export interface PublicChapterReaderResponse {
  readonly story: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
  };
  readonly chapter: {
    readonly id: string;
    readonly number: number;
    readonly title: string;
    readonly slug: string;
    readonly content: string;
    readonly contentFormat: string;
    readonly wordCount: number;
    readonly views: number;
    readonly comments: number;
    readonly publishedAt: string;
    readonly updatedAt: string;
  };
  readonly navigation: {
    readonly previous: PublicChapterNavigationResponse | null;
    readonly next: PublicChapterNavigationResponse | null;
  };
}

export function toPublicChapterReaderResponse(
  result: PublicChapterReaderDto,
): PublicChapterReaderResponse {
  return {
    story: { ...result.story },
    chapter: {
      ...result.chapter,
      publishedAt: result.chapter.publishedAt.toISOString(),
      updatedAt: result.chapter.updatedAt.toISOString(),
    },
    navigation: {
      previous: toNavigationResponse(result.navigation.previous),
      next: toNavigationResponse(result.navigation.next),
    },
  };
}

function toNavigationResponse(
  chapter: PublicChapterNavigationDto | null,
): PublicChapterNavigationResponse | null {
  if (!chapter) {
    return null;
  }

  return {
    ...chapter,
    publishedAt: chapter.publishedAt.toISOString(),
  };
}
