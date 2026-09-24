import type { OcrBox } from '../../../domain';

export interface RequestChapterOcrResponse {
  readonly chapterId: string;
  readonly language: string;
  readonly queuedPages: number;
  readonly jobId: string;
}

export interface OcrLineResponse {
  readonly text: string;
  readonly confidence: number;
  readonly box: OcrBox;
}

export interface OcrPageResponse {
  readonly mediaAssetId: string;
  readonly sortOrder: number;
  readonly status: string;
  readonly text: string | null;
  readonly lineCount: number;
  readonly failureReason: string | null;
  readonly completedAt: string | null;
  readonly lines: readonly OcrLineResponse[];
}

export interface ChapterOcrResponse {
  readonly chapterId: string;
  readonly language: string;
  readonly pages: readonly OcrPageResponse[];
}
