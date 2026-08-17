import { Inject, Injectable } from '@nestjs/common';

import type { PublicChapterReaderDto } from '../../dto';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import {
  ChapterNotFoundException,
  InvalidChapterFieldException,
} from '../../../domain';
import { GetPublicChapterReaderQuery } from './get-public-chapter-reader.query';

const CHAPTER_NUMBER_PATTERN = /^\d{1,8}(?:\.\d{1,2})?$/;

@Injectable()
export class GetPublicChapterReaderQueryHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) {}

  async execute(
    query: GetPublicChapterReaderQuery,
  ): Promise<PublicChapterReaderDto> {
    const storySlug = query.storySlug.trim().toLowerCase();

    if (!storySlug) {
      throw new ChapterNotFoundException();
    }

    const chapterNumber = validateChapterNumber(query.chapterNumber);

    const result = await this.persistence.findPublicReader(
      storySlug,
      chapterNumber,
    );

    if (!result) {
      throw new ChapterNotFoundException(
        query.chapterNumber.trim() || undefined,
      );
    }

    return result;
  }
}

function validateChapterNumber(value: string): string {
  const normalized = value.trim();

  if (!CHAPTER_NUMBER_PATTERN.test(normalized)) {
    throw new InvalidChapterFieldException(
      'chapterNumber',
      'Số chương không hợp lệ',
    );
  }

  return normalized;
}
