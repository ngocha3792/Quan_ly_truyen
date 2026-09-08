import type { ChapterContentDocument } from '../../domain';

export interface PublicChapterReaderStoryDto {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

export interface PublicChapterNavigationDto {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly publishedAt: Date;
}

export interface PublicChapterReaderChapterBaseDto {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly wordCount: number;
  readonly views: number;
  readonly comments: number;
  readonly publishedAt: Date;
  readonly updatedAt: Date;
}

export interface PublicUnlockedChapterReaderDto extends PublicChapterReaderChapterBaseDto {
  readonly access: {
    readonly state: 'FREE' | 'ENTITLED' | 'BYPASS';
    readonly priceCredits: string | null;
  };
  readonly content: string;
  readonly contentFormat: string;
  readonly contentDocument?: ChapterContentDocument;
  readonly documentSchemaVersion?: number;
  readonly media?: readonly PublicChapterMediaDto[];
}

export interface PublicChapterMediaSliceDto {
  readonly id: string;
  readonly sliceIndex: number;
  readonly width: number;
  readonly height: number;
  readonly offsetY: number;
  readonly aspectRatio: number;
  readonly urls: {
    readonly avif: string;
    readonly webp: string;
    readonly jpeg: string;
  };
}

export interface PublicChapterMediaDto {
  readonly mediaAssetId: string;
  readonly sortOrder: number;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly width: number;
  readonly height: number;
  readonly slices: readonly PublicChapterMediaSliceDto[];
}

export interface PublicLockedChapterReaderDto extends PublicChapterReaderChapterBaseDto {
  readonly access: {
    readonly state: 'LOCKED';
    readonly priceCredits: string;
  };
  readonly previewContent: string;
  readonly previewFormat: string;
}

export type PublicChapterReaderChapterDto =
  PublicUnlockedChapterReaderDto | PublicLockedChapterReaderDto;

export interface PublicChapterReaderDto {
  readonly story: PublicChapterReaderStoryDto;
  readonly chapter: PublicChapterReaderChapterDto;
  readonly navigation: {
    readonly previous: PublicChapterNavigationDto | null;
    readonly next: PublicChapterNavigationDto | null;
  };
}
