import type { OcrLine } from '../../domain';

export const OCR_PROVIDER_PORT = Symbol.for(
  'quan-ly-truyen.modules.ocr.provider',
);

export interface OcrRecognisePage {
  readonly mediaAssetId: string;
  readonly imageUrl: string;
}

export interface OcrRecognisedPage {
  readonly mediaAssetId: string;
  readonly lines: readonly OcrLine[];
  readonly text: string;
}

export interface OcrProviderPort {
  readonly supportedLanguages: readonly string[];
  /** Pages are sent one language at a time; see OcrConfig.maxBatchSize. */
  readonly maxBatchSize: number;
  recognise(
    pages: readonly OcrRecognisePage[],
    language: string,
  ): Promise<readonly OcrRecognisedPage[]>;
}
