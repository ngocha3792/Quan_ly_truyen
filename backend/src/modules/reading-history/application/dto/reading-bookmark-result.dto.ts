export interface ReadingBookmarkResultDto {
  readonly id: string;
  readonly storyId: string;
  readonly chapterId: string;
  readonly position: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
