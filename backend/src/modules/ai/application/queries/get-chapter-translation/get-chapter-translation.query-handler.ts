import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '@/common/exceptions';
import {
  CHAPTER_PERSISTENCE_PORT,
  ChapterPersistencePort,
} from '@/modules/chapters';

import {
  CHAPTER_TRANSLATION_PERSISTENCE_PORT,
  ChapterTranslationPersistencePort,
  ChapterTranslationRecord,
} from '../../ports/chapter-translation.persistence.port';
import { GetChapterTranslationQuery } from './get-chapter-translation.query';

@Injectable()
export class GetChapterTranslationQueryHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly chapters: ChapterPersistencePort,
    @Inject(CHAPTER_TRANSLATION_PERSISTENCE_PORT)
    private readonly translations: ChapterTranslationPersistencePort,
  ) {}

  async execute(
    query: GetChapterTranslationQuery,
  ): Promise<ChapterTranslationRecord | null> {
    const chapter = await this.chapters.findOwnedById(
      query.userId,
      query.storyId,
      query.chapterId,
    );

    if (!chapter) {
      throw new ResourceNotFoundException({
        resource: 'chương',
        identifier: query.chapterId,
      });
    }

    return this.translations.findByChapterAndLanguage(
      query.chapterId,
      query.targetLanguageCode,
    );
  }
}
