export const TRANSLATE_CHAPTER_JOB = 'ai.translate-chapter.v1';

export interface TranslateChapterJobV1 {
  version: 1;
  translationId: string;
  chapterId: string;
  targetLanguageCode: string;
}

export function isTranslateChapterJobV1(
  value: unknown,
): value is TranslateChapterJobV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const payload = value as Partial<TranslateChapterJobV1>;

  return (
    payload.version === 1 &&
    typeof payload.translationId === 'string' &&
    typeof payload.chapterId === 'string' &&
    typeof payload.targetLanguageCode === 'string'
  );
}
