import type { ChapterTranslationStatus } from '../../../domain/enums';

export interface RequestChapterTranslationResultView {
  readonly id: string;
  readonly status: ChapterTranslationStatus;
  readonly targetLanguageCode: string;
}
