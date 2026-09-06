export const TRANSLATE_CHAPTER_JOB = 'ai.translate-chapter.v1';
export const AUTO_TRANSLATE_CHAPTER_PUBLISHED_EVENT =
  'ai.auto-translate-chapter-published.v1';

export interface AutoTranslateChapterPublishedV1 {
  readonly version: 1;
  readonly userId: string;
  readonly storyId: string;
  readonly chapterId: string;
}

export function isAutoTranslateChapterPublishedV1(
  value: unknown,
): value is AutoTranslateChapterPublishedV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Partial<AutoTranslateChapterPublishedV1>;
  return (
    payload.version === 1 &&
    typeof payload.userId === 'string' &&
    typeof payload.storyId === 'string' &&
    typeof payload.chapterId === 'string'
  );
}

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
