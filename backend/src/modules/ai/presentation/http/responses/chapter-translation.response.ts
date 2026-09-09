import type { ChapterTranslationStatus } from '../../../domain/enums';

import type { ChapterTranslationRecord } from '../../../application/ports/chapter-translation.persistence.port';
import type { RequestChapterTranslationResultView } from '../../../application/commands/request-chapter-translation/request-chapter-translation.view';

export interface ChapterTranslationResponse {
  readonly generation: number;
  readonly sourceVersion: number | null;
  readonly sourceContentHash: string;
  readonly reviewStatus:
    'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';
  readonly revisionNotes: string | null;
  readonly id: string;
  readonly targetLanguageCode: string;
  readonly status: ChapterTranslationStatus;
  readonly translatedTitle: string | null;
  readonly translatedContent: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RequestChapterTranslationResponse {
  readonly id: string;
  readonly targetLanguageCode: string;
  readonly status: ChapterTranslationStatus;
}

export function toChapterTranslationResponse(
  record: ChapterTranslationRecord,
): ChapterTranslationResponse {
  return {
    generation: record.generation ?? 1,
    sourceVersion: record.sourceVersion ?? null,
    sourceContentHash: record.sourceContentHash,
    reviewStatus: record.reviewStatus ?? 'PENDING',
    revisionNotes: record.revisionNotes ?? null,
    id: record.id,
    targetLanguageCode: record.targetLanguageCode,
    status: record.status,
    translatedTitle: record.translatedTitle,
    translatedContent: record.translatedContent,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toRequestChapterTranslationResponse(
  view: RequestChapterTranslationResultView,
): RequestChapterTranslationResponse {
  return {
    id: view.id,
    targetLanguageCode: view.targetLanguageCode,
    status: view.status,
  };
}
