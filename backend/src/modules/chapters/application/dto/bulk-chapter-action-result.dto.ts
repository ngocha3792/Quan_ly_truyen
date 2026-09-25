import type { ChapterResultDto } from './chapter-result.dto';

export interface SkippedBulkChapterDto {
  readonly chapterId: string;

  readonly number: number;

  readonly title: string;

  readonly code: string;

  readonly message: string;
}

/**
 * Kết quả một lô: phần đã xong, phần bị bỏ qua kèm lý do, và số còn lại chưa
 * tới lượt vì vượt trần mỗi lần gọi.
 */
export interface BulkChapterActionResultDto {
  readonly changed: readonly ChapterResultDto[];

  readonly skipped: readonly SkippedBulkChapterDto[];

  readonly remaining: number;
}
