export const CHAPTER_TRANSLATION_QUEUE_PORT = Symbol.for(
  'modules.ai.chapter-translation-queue',
);

export interface EnqueueChapterTranslationInput {
  readonly translationId: string;
  readonly chapterId: string;
  readonly targetLanguageCode: string;
}

export interface ChapterTranslationQueuePort {
  enqueue(input: EnqueueChapterTranslationInput): Promise<void>;
}
