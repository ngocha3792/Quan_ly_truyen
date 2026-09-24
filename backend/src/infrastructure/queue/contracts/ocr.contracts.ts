export const RECOGNISE_CHAPTER_PAGES_JOB = 'ocr.recognise-chapter-pages.v1';

export interface RecogniseChapterPagesJobV1 {
  readonly version: 1;
  readonly chapterId: string;
  readonly language: string;
}

export function isRecogniseChapterPagesJobV1(
  value: unknown,
): value is RecogniseChapterPagesJobV1 {
  const candidate = value as Record<string, unknown> | null;

  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    candidate['version'] === 1 &&
    typeof candidate['chapterId'] === 'string' &&
    typeof candidate['language'] === 'string'
  );
}
