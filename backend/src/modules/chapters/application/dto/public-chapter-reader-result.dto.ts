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
