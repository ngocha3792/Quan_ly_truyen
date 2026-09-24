import type {
  PublicChapterNavigationDto,
  PublicChapterReaderDto,
} from '../../../application';
import type {
  ChapterContentBlock,
  ChapterContentDocument,
} from '../../../domain';
import { resolveChapterImageBlock } from '../../../domain';

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
    readonly unlockPolicy?: 'PERMANENT_PAID' | 'EARLY_ACCESS';
    readonly freeAt?: string | null;
  };
  readonly content: string;
  readonly contentFormat: string;
  readonly contentDocument?: PublicChapterReaderDocument;
  readonly documentSchemaVersion?: number;
}

/**
 * Block dành cho reader. Giống block lưu trữ, nhưng paragraph chỉ chứa đúng một
 * ảnh Markdown được đổi sang type 'image' kèm url/alt đã kiểm tra an toàn, để
 * client render thẻ img thay vì in chuỗi URL.
 */
export type PublicChapterReaderBlock =
  | ChapterContentBlock
  | {
      readonly id: string;
      readonly type: 'image';
      readonly text: string;
      readonly marks: readonly [];
      readonly url: string;
      readonly alt: string;
    };

export interface PublicChapterReaderDocument {
  readonly schemaVersion: number;
  readonly blocks: readonly PublicChapterReaderBlock[];
}

function toReaderDocument(
  document: ChapterContentDocument,
): PublicChapterReaderDocument {
  return {
    schemaVersion: document.schemaVersion,
    blocks: document.blocks.map((block) => {
      if (block.type !== 'paragraph') return block;
      const image = resolveChapterImageBlock(block.text);
      return image
        ? {
            id: block.id,
            type: 'image' as const,
            text: block.text,
            marks: [] as const,
            ...image,
          }
        : block;
    }),
  };
}

export interface PublicLockedChapterReaderResponse extends PublicChapterReaderChapterBaseResponse {
  readonly access: {
    readonly state: 'LOCKED';
    readonly priceCredits: string;
    readonly unlockPolicy?: 'PERMANENT_PAID' | 'EARLY_ACCESS';
    readonly freeAt?: string | null;
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
    ...('contentDocument' in chapter && chapter.contentDocument
      ? {
          contentDocument: toReaderDocument(chapter.contentDocument),
          documentSchemaVersion: chapter.documentSchemaVersion,
        }
      : {}),
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
