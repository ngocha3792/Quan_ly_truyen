export const OCR_QUEUE_PORT = Symbol.for('quan-ly-truyen.modules.ocr.queue');

export interface OcrQueuePort {
  enqueueChapter(chapterId: string, language: string): Promise<string>;
}
