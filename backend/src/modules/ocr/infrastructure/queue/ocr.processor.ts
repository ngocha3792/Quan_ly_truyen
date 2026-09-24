import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';

import { QUEUE_NAMES } from '@/infrastructure/queue';
import {
  isRecogniseChapterPagesJobV1,
  RECOGNISE_CHAPTER_PAGES_JOB,
  type RecogniseChapterPagesJobV1,
} from '@/infrastructure/queue/contracts';
import { getWorkerConcurrency } from '@/infrastructure/queue/worker-options';
import { MEDIA_STORAGE, type MediaStoragePort } from '@/modules/media';

import {
  OCR_PERSISTENCE_PORT,
  OCR_PROVIDER_PORT,
  type OcrPersistencePort,
  type OcrProviderPort,
} from '../../application';
import { OcrProviderException } from '../../domain';

@Processor(QUEUE_NAMES.OCR, { concurrency: getWorkerConcurrency() })
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(
    @Inject(OCR_PERSISTENCE_PORT)
    private readonly persistence: OcrPersistencePort,
    @Inject(OCR_PROVIDER_PORT) private readonly provider: OcrProviderPort,
    @Inject(MEDIA_STORAGE) private readonly media: MediaStoragePort,
  ) {
    super();
  }

  async process(job: Job<RecogniseChapterPagesJobV1>): Promise<void> {
    if (
      job.name !== RECOGNISE_CHAPTER_PAGES_JOB ||
      !isRecogniseChapterPagesJobV1(job.data)
    ) {
      throw new UnrecoverableError(`Unsupported OCR job: ${job.name}`);
    }

    const { chapterId, language } = job.data;
    const pending = await this.persistence.claimChapter(chapterId, language);
    if (pending.length === 0) return;

    const batchSize = Math.max(1, this.provider.maxBatchSize);
    for (let index = 0; index < pending.length; index += batchSize) {
      const batch = pending.slice(index, index + batchSize);
      const ids = batch.map((page) => page.mediaAssetId);

      try {
        const recognised = await this.provider.recognise(
          batch.map((page) => ({
            mediaAssetId: page.mediaAssetId,
            imageUrl: this.media.buildUrl({
              publicId: page.publicId,
              resourceType: 'image',
              preset: 'chapterImage',
            }),
          })),
          language,
        );

        await this.persistence.saveCompleted(chapterId, language, recognised);
      } catch (error: unknown) {
        // A retryable provider failure is rethrown so BullMQ replays the job;
        // anything else is recorded against the pages and the batch moves on,
        // so one unreadable page cannot strand a whole chapter.
        if (error instanceof OcrProviderException && error.retryable)
          throw error;

        const reason =
          error instanceof Error ? error.message : 'Nhận dạng thất bại';
        await this.persistence.markFailed(chapterId, language, ids, reason);
        this.logger.warn(
          `OCR batch failed chapter=${chapterId} language=${language} pages=${ids.length}: ${reason}`,
        );
      }
    }
  }
}
