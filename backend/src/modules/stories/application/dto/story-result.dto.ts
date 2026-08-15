export interface StoryCategoryResultDto {
  readonly id: string;

  readonly name: string;

  readonly slug: string;

  readonly isPrimary: boolean;
}

export interface StoryTagResultDto {
  readonly id: string;

  readonly name: string;

  readonly slug: string;
}

export interface StoryResultDto {
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

  readonly categories: readonly StoryCategoryResultDto[];

  readonly tags: readonly StoryTagResultDto[];

  readonly version: number;

  readonly createdAt: Date;

  readonly updatedAt: Date;
}
