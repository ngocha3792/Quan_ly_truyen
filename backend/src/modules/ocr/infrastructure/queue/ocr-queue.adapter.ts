import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Optional } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { ExternalServiceException } from '@/common/exceptions';
import { QUEUE_NAMES } from '@/infrastructure/queue';
import {
  RECOGNISE_CHAPTER_PAGES_JOB,
  type RecogniseChapterPagesJobV1,
} from '@/infrastructure/queue/contracts';

import type { OcrQueuePort } from '../../application';

@Injectable()
export class OcrQueueAdapter implements OcrQueuePort {
  constructor(
    @Optional() @InjectQueue(QUEUE_NAMES.OCR) private readonly queue?: Queue,
  ) {}

  async enqueueChapter(chapterId: string, language: string): Promise<string> {
    if (!this.queue) {
      throw new ExternalServiceException({
        service: 'Hàng đợi OCR',
        code: 'OCR_QUEUE_UNAVAILABLE',
        message: 'Dịch vụ nhận dạng chữ hiện không khả dụng',
      });
    }

    const payload: RecogniseChapterPagesJobV1 = {
      version: 1,
      chapterId,
      language,
    };
    // One in-flight job per chapter and language; re-requesting while a job is
    // still queued reuses it rather than recognising the same pages twice.
    const jobId = `${chapterId}:${language}`;
    const job = await this.queue.add(RECOGNISE_CHAPTER_PAGES_JOB, payload, {
      jobId,
    });

    return String(job.id ?? jobId);
  }
}
