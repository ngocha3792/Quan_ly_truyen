import type { ChapterTranslationStatus } from '../../domain/enums';

export const CHAPTER_TRANSLATION_PERSISTENCE_PORT = Symbol.for(
  'modules.ai.chapter-translation-persistence',
);

export interface ChapterTranslationRecord {
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
  readonly chapterId: string;
  readonly targetLanguageCode: string;
  readonly requestedById: string;
  readonly connectionId: string;
  readonly sourceContentHash: string;
}

export interface CompleteChapterTranslationInput {
  readonly translationId: string;
  readonly translatedTitle: string;
  readonly translatedContent: string;
}

export interface FailChapterTranslationInput {
  readonly translationId: string;
  readonly errorCode: string;
  readonly errorMessage: string;
}

export interface ChapterSourceForTranslation {
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

  markProcessing(translationId: string): Promise<void>;

  markCompleted(input: CompleteChapterTranslationInput): Promise<void>;

  markFailed(input: FailChapterTranslationInput): Promise<void>;

  /**
   * Đọc trực tiếp title/content của chapter bằng Prisma, không qua
   * CHAPTER_PERSISTENCE_PORT.findOwnedById (cần userId/storyId để check
   * ownership — vô nghĩa trong ngữ cảnh worker vì ownership đã được xác
   * nhận một lần lúc tạo yêu cầu dịch). Giữ AiWorkerModule không phụ
   * thuộc ChaptersModule/AuthorsModule.
   */
  findChapterSource(
    chapterId: string,
  ): Promise<ChapterSourceForTranslation | null>;
}
