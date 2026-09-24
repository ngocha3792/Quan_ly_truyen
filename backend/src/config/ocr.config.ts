import { registerAs } from '@nestjs/config';

import type { OcrConfig } from './config.types';

export const OCR_CONFIG_KEY = 'ocr';

export default registerAs(OCR_CONFIG_KEY, (): OcrConfig => ({
  baseUrl: process.env.OCR_BASE_URL ?? '',
  apiKey: process.env.OCR_API_KEY ?? '',
  defaultLanguage: process.env.OCR_DEFAULT_LANGUAGE ?? 'ch',
  requestTimeoutMs: Number(process.env.OCR_REQUEST_TIMEOUT_MS ?? 120_000),
  // The recognition host keeps a single engine in memory and swaps it when
  // the language changes, so a batch is only worth sending one language at a
  // time and is capped to what that host accepts.
  maxBatchSize: Number(process.env.OCR_MAX_BATCH_SIZE ?? 20),
  maxImageBytes: Number(process.env.OCR_MAX_IMAGE_BYTES ?? 10 * 1024 * 1024),
}));
