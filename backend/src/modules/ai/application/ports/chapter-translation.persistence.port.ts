import type { ChapterTranslationStatus } from '../../domain/enums';

export const CHAPTER_TRANSLATION_PERSISTENCE_PORT = Symbol.for(
  'modules.ai.chapter-translation-persistence',
);

export interface ChapterTranslationRecord {
  readonly generation?: number;
  readonly sourceVersion?: number | null;
  readonly reviewStatus?:
    'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';
  readonly revisionNotes?: string | null;
  readonly id: string;
  readonly chapterId: string;
  readonly targetLanguageCode: string;
  readonly requestedById: string;
  readonly connectionId: string | null;
  readonly status: ChapterTranslationStatus;
  readonly sourceContentHash: string;
  readonly translatedTitle: string | null;
  readonly translatedContent: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UpsertPendingChapterTranslationInput {
  readonly sourceVersion?: number;
  readonly chapterId: string;
  readonly targetLanguageCode: string;
  readonly requestedById: string;
  readonly connectionId: string;
  readonly sourceContentHash: string;
}

export interface CompleteChapterTranslationInput {
  readonly leaseToken?: string;
  readonly generation?: number;
  readonly translationId: string;
  readonly translatedTitle: string;
  readonly translatedContent: string;
}

export interface FailChapterTranslationInput {
  readonly leaseToken?: string;
  readonly generation?: number;
  readonly translationId: string;
  readonly errorCode: string;
  readonly errorMessage: string;
}

export interface ChapterSourceForTranslation {
  readonly version?: number;
  readonly storyId: string;
  readonly title: string;
  readonly content: string;
}

export interface ChapterTranslationPersistencePort {
  findByChapterAndLanguage(
    chapterId: string,
    targetLanguageCode: string,
  ): Promise<ChapterTranslationRecord | null>;

  findById(translationId: string): Promise<ChapterTranslationRecord | null>;

  upsertPending(
    input: UpsertPendingChapterTranslationInput,
  ): Promise<ChapterTranslationRecord>;

  markProcessing(
    translationId: string,
    generation: number,
    leaseToken: string,
  ): Promise<boolean>;

  markCompleted(input: CompleteChapterTranslationInput): Promise<void>;

  markFailed(input: FailChapterTranslationInput): Promise<void>;

  /** Recheck current owner/contributor permission when the worker reads source. */
  findChapterSource(
    chapterId: string,
    userId?: string,
  ): Promise<ChapterSourceForTranslation | null>;
}
