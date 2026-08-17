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

export interface PublicChapterReaderChapterDto {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly content: string;
  readonly contentFormat: string;
  readonly wordCount: number;
  readonly views: number;
  readonly comments: number;
  readonly publishedAt: Date;
  readonly updatedAt: Date;
}

export interface PublicChapterReaderDto {
  readonly story: PublicChapterReaderStoryDto;
  readonly chapter: PublicChapterReaderChapterDto;
  readonly navigation: {
    readonly previous: PublicChapterNavigationDto | null;
    readonly next: PublicChapterNavigationDto | null;
  };
}
