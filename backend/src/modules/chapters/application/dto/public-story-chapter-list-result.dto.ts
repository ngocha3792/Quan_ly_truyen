export interface PublicStoryChapterListItemDto {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly publishedAt: Date;
}

export interface PublicStoryChapterListDto {
  readonly items: readonly PublicStoryChapterListItemDto[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}
