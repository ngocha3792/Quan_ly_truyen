export const OCR_STATUSES = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
] as const;

export type OcrStatus = (typeof OCR_STATUSES)[number];
