import type { OcrLine, OcrStatus } from '../../domain';

export const OCR_PERSISTENCE_PORT = Symbol.for(
  'quan-ly-truyen.modules.ocr.persistence',
);

export interface OcrPageRecord {
  readonly mediaAssetId: string;
  readonly sortOrder: number;
  readonly language: string;
  readonly status: OcrStatus;
  readonly text: string | null;
  readonly lines: readonly OcrLine[];
  readonly lineCount: number;
  readonly failureReason: string | null;
  readonly completedAt: Date | null;
}

export interface OcrPendingPage {
  readonly mediaAssetId: string;
  readonly publicId: string;
  readonly sortOrder: number;
}

export interface OcrCompletedPage {
  readonly mediaAssetId: string;
  readonly text: string;
  readonly lines: readonly OcrLine[];
}

export interface OcrPersistencePort {
  /**
   * Creates or resets a row per page and returns how many are now awaiting
   * recognition, so the caller can refuse to queue a chapter with no pages.
   */
  requestChapter(input: {
    chapterId: string;
    language: string;
    requestedById: string;
  }): Promise<number>;

  claimChapter(
    chapterId: string,
    language: string,
  ): Promise<readonly OcrPendingPage[]>;

  saveCompleted(
    chapterId: string,
    language: string,
    pages: readonly OcrCompletedPage[],
  ): Promise<void>;

  markFailed(
    chapterId: string,
    language: string,
    mediaAssetIds: readonly string[],
    reason: string,
  ): Promise<void>;

  listChapter(
    chapterId: string,
    language: string,
  ): Promise<readonly OcrPageRecord[]>;

  chapterExists(chapterId: string): Promise<boolean>;
}
