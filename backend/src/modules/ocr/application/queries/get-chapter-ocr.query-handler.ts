import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { OcrConfig } from '@/config';
import { OCR_CONFIG_KEY } from '@/config';

import {
  OCR_PERSISTENCE_PORT,
  type OcrPageRecord,
  type OcrPersistencePort,
} from '../ports';
import { OcrChapterNotFoundException } from '../../domain';

export interface GetChapterOcrQuery {
  readonly chapterId: string;
  readonly language?: string;
}

export interface GetChapterOcrResult {
  readonly chapterId: string;
  readonly language: string;
  readonly pages: readonly OcrPageRecord[];
}

@Injectable()
export class GetChapterOcrQueryHandler {
  constructor(
    @Inject(OCR_PERSISTENCE_PORT)
    private readonly persistence: OcrPersistencePort,
    private readonly config: ConfigService,
  ) {}

  async execute(query: GetChapterOcrQuery): Promise<GetChapterOcrResult> {
    const defaults = this.config.getOrThrow<OcrConfig>(OCR_CONFIG_KEY);
    const language = query.language ?? defaults.defaultLanguage;

    if (!(await this.persistence.chapterExists(query.chapterId))) {
      throw new OcrChapterNotFoundException(query.chapterId);
    }

    return {
      chapterId: query.chapterId,
      language,
      pages: await this.persistence.listChapter(query.chapterId, language),
    };
  }
}
