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
  readonly chapter: PublicChapterReaderChapterResponse;
  readonly navigation: {
    readonly previous: PublicChapterNavigationResponse | null;
    readonly next: PublicChapterNavigationResponse | null;
  };
}

interface PublicChapterReaderChapterBaseResponse {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly wordCount: number;
  readonly views: number;
  readonly comments: number;
  readonly publishedAt: string;
  readonly updatedAt: string;
}

export interface PublicUnlockedChapterReaderResponse extends PublicChapterReaderChapterBaseResponse {
  readonly access: {
    readonly state: 'FREE' | 'ENTITLED' | 'BYPASS';
    readonly priceCredits: string | null;
  };
  readonly content: string;
  readonly contentFormat: string;
}

export interface PublicLockedChapterReaderResponse extends PublicChapterReaderChapterBaseResponse {
  readonly access: {
    readonly state: 'LOCKED';
    readonly priceCredits: string;
  };
  readonly previewContent: string;
  readonly previewFormat: string;
}

export type PublicChapterReaderChapterResponse =
  PublicUnlockedChapterReaderResponse | PublicLockedChapterReaderResponse;

export function toPublicChapterReaderResponse(
  result: PublicChapterReaderDto,
): PublicChapterReaderResponse {
  return {
    story: { ...result.story },
    chapter: toChapterResponse(result.chapter),
    navigation: {
      previous: toNavigationResponse(result.navigation.previous),
      next: toNavigationResponse(result.navigation.next),
    },
  };
}

function toChapterResponse(
  chapter: PublicChapterReaderDto['chapter'],
): PublicChapterReaderChapterResponse {
  const common = {
    id: chapter.id,
    number: chapter.number,
    title: chapter.title,
    slug: chapter.slug,
    wordCount: chapter.wordCount,
    views: chapter.views,
    comments: chapter.comments,
    publishedAt: chapter.publishedAt.toISOString(),
    updatedAt: chapter.updatedAt.toISOString(),
  };

  if ('previewContent' in chapter) {
    return {
      ...common,
      access: chapter.access,
      previewContent: chapter.previewContent,
      previewFormat: chapter.previewFormat,
    };
  }

  return {
    ...common,
    access: chapter.access,
    content: chapter.content,
    contentFormat: chapter.contentFormat,
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
