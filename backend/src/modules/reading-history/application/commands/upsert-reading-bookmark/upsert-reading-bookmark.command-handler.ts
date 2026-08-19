import { Inject, Injectable } from '@nestjs/common';

import { ReadingHistoryChapterNotFoundException } from '../../../domain';
import { requireReadingHistoryUserId } from '../../../domain/policies/reading-history-auth.policy';
import type { ReadingBookmarkResultDto } from '../../dto';
import {
  READING_BOOKMARK_PERSISTENCE_PORT,
  type ReadingBookmarkPersistencePort,
} from '../../ports';
import { UpsertReadingBookmarkCommand } from './upsert-reading-bookmark.command';

@Injectable()
export class UpsertReadingBookmarkCommandHandler {
  constructor(
    @Inject(READING_BOOKMARK_PERSISTENCE_PORT)
    private readonly persistence: ReadingBookmarkPersistencePort,
  ) {}

  async execute(
    command: UpsertReadingBookmarkCommand,
  ): Promise<ReadingBookmarkResultDto> {
    const result = await this.persistence.upsertMine({
      userId: requireReadingHistoryUserId(command.userId),
      chapterId: command.chapterId,
      position: 0,
    });

    if (result.status === 'chapter_not_found') {
      throw new ReadingHistoryChapterNotFoundException(command.chapterId);
    }

    return result.bookmark;
  }
}
