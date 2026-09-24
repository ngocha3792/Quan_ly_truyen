import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { OcrConfig } from '@/config';
import { OCR_CONFIG_KEY } from '@/config';

import {
  OCR_PERSISTENCE_PORT,
  OCR_PROVIDER_PORT,
  OCR_QUEUE_PORT,
  type OcrPersistencePort,
  type OcrProviderPort,
  type OcrQueuePort,
} from '../ports';
import {
  OcrChapterNotFoundException,
  OcrInvalidInputException,
  OcrPagesMissingException,
} from '../../domain';

export interface RequestChapterOcrCommand {
  readonly chapterId: string;
  readonly requestedById: string;
  readonly language?: string;
}

export interface RequestChapterOcrResult {
  readonly chapterId: string;
  readonly language: string;
  readonly queuedPages: number;
  readonly jobId: string;
}

@Injectable()
export class RequestChapterOcrCommandHandler {
  constructor(
    @Inject(OCR_PERSISTENCE_PORT)
    private readonly persistence: OcrPersistencePort,
    @Inject(OCR_PROVIDER_PORT) private readonly provider: OcrProviderPort,
    @Inject(OCR_QUEUE_PORT) private readonly queue: OcrQueuePort,
    private readonly config: ConfigService,
  ) {}

  async execute(
    command: RequestChapterOcrCommand,
  ): Promise<RequestChapterOcrResult> {
    const defaults = this.config.getOrThrow<OcrConfig>(OCR_CONFIG_KEY);
    const language = command.language ?? defaults.defaultLanguage;

    if (!this.provider.supportedLanguages.includes(language)) {
      throw new OcrInvalidInputException(
        `Ngôn ngữ OCR phải là một trong ${this.provider.supportedLanguages.join(', ')}`,
        'language',
      );
    }

    if (!(await this.persistence.chapterExists(command.chapterId))) {
      throw new OcrChapterNotFoundException(command.chapterId);
    }

    const queuedPages = await this.persistence.requestChapter({
      chapterId: command.chapterId,
      language,
      requestedById: command.requestedById,
    });

    if (queuedPages === 0) throw new OcrPagesMissingException();

    const jobId = await this.queue.enqueueChapter(command.chapterId, language);

    return { chapterId: command.chapterId, language, queuedPages, jobId };
  }
}
