import type { ChapterRecord } from '@/modules/chapters';
import type { ChapterTranslationRecord } from './chapter-translation.persistence.port';

export const TRANSLATION_REVIEW_PORT = Symbol('TRANSLATION_REVIEW_PORT');
export interface ReviewTranslationInput {
  userId: string;
  storyId: string;
  chapterId: string;
  targetLanguageCode: string;
  translationId: string;
  generation: number;
  expectedVersion: number;
  decision: 'APPROVE' | 'REJECT' | 'REQUEST_REVISION';
  notes?: string;
  translatedTitle?: string;
  translatedContent?: string;
  requestId?: string;
}
export interface TranslationReviewPort {
  review(input: ReviewTranslationInput): Promise<{
    translation: ChapterTranslationRecord;
    chapter: ChapterRecord | null;
  }>;
}
