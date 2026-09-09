import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Optional } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { ExternalServiceException } from '@/common/exceptions';
import { QUEUE_NAMES } from '@/infrastructure/queue';
import {
  TRANSLATE_CHAPTER_JOB,
  TranslateChapterJobV1,
} from '@/infrastructure/queue/contracts';

import {
  ChapterTranslationQueuePort,
  EnqueueChapterTranslationInput,
} from '../../application/ports/chapter-translation-queue.port';

@Injectable()
export class ChapterTranslationQueueAdapter implements ChapterTranslationQueuePort {
  constructor(
    @Optional()
    @InjectQueue(QUEUE_NAMES.AI)
    private readonly queue?: Queue,
  ) {}

  async enqueue(input: EnqueueChapterTranslationInput): Promise<void> {
    if (!this.queue) {
      throw new ExternalServiceException({
        service: 'Hàng đợi dịch AI',
        message: 'Dịch vụ hàng đợi hiện không khả dụng. Vui lòng thử lại sau.',
      });
    }

    const payload: TranslateChapterJobV1 = {
      version: 1,
      translationId: input.translationId,
      chapterId: input.chapterId,
      targetLanguageCode: input.targetLanguageCode,
      generation: input.generation,
    };

    await this.queue.add(TRANSLATE_CHAPTER_JOB, payload, {
      jobId: `${input.translationId}-${input.generation ?? 1}`,
    });
  }
}
