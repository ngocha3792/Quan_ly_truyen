import type { OcrStatus } from '../../domain';
import type { OcrLine } from '../../domain';

export interface OcrPageDto {
  readonly mediaAssetId: string;
  readonly sortOrder: number;
  readonly status: OcrStatus;
  readonly text: string | null;
  readonly lineCount: number;
  readonly failureReason: string | null;
  readonly completedAt: Date | null;
  readonly lines: readonly OcrLine[];
}

export interface ChapterOcrDto {
  readonly chapterId: string;
  readonly language: string;
  readonly pages: readonly OcrPageDto[];
}
