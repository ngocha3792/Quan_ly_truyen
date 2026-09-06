import type { ChapterTranslationStatus } from '@/generated/prisma/client';

export interface RequestChapterTranslationResultView {
  readonly id: string;
  readonly status: ChapterTranslationStatus;
  readonly targetLanguageCode: string;
}
