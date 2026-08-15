export interface StoryCategoryOptionDto {
  readonly id: string;

  readonly parentId: string | null;

  readonly name: string;

  readonly slug: string;

  readonly sortOrder: number;
}

export interface StoryTagOptionDto {
  readonly id: string;

  readonly name: string;

  readonly slug: string;
}
