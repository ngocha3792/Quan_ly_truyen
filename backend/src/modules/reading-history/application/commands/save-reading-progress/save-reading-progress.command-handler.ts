import { Inject, Injectable } from '@nestjs/common';

import {
  ReadingHistoryChapterNotFoundException,
  ReadingHistoryStoryNotFoundException,
} from '../../../domain';
import type { ReadingHistoryEntryResultDto } from '../../dto';
import {
  READING_HISTORY_PERSISTENCE_PORT,
  type ReadingHistoryPersistencePort,
} from '../../ports';
import { requireReadingHistoryUserId } from '../../reading-history-auth.util';
import { SaveReadingProgressCommand } from './save-reading-progress.command';

@Injectable()
export class SaveReadingProgressCommandHandler {
  constructor(
    @Inject(READING_HISTORY_PERSISTENCE_PORT)
    private readonly persistence: ReadingHistoryPersistencePort,
  ) {}

  async execute(
    command: SaveReadingProgressCommand,
  ): Promise<ReadingHistoryEntryResultDto> {
    const result = await this.persistence.saveProgress({
      userId: requireReadingHistoryUserId(command.userId),
      storyId: command.storyId,
      chapterId: command.chapterId,
      position: Math.max(0, Math.trunc(command.position)),
      readAt: new Date(),
    });

    if (result.status === 'story_not_found') {
      throw new ReadingHistoryStoryNotFoundException(command.storyId);
    }
    if (result.status === 'chapter_not_found') {
      throw new ReadingHistoryChapterNotFoundException(command.chapterId);
    }

    return result.entry;
  }
}
