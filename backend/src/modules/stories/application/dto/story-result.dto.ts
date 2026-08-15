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

  readonly version: number;

  readonly createdAt: Date;

  readonly updatedAt: Date;
}
