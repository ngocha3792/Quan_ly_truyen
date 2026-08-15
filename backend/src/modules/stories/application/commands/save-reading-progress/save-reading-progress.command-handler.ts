import { Inject, Injectable } from '@nestjs/common';

import { ChapterNotFoundException, StoryNotFoundException } from '../../../domain';
import type { ReadingHistoryEntryResultDto } from '../../dto';
import {
  READER_ENGAGEMENT_PERSISTENCE_PORT,
  type ReaderEngagementPersistencePort,
} from '../../ports';
import { requireReaderUserId } from '../../reader-engagement.util';
import { SaveReadingProgressCommand } from './save-reading-progress.command';

@Injectable()
export class SaveReadingProgressCommandHandler {
  constructor(
    @Inject(READER_ENGAGEMENT_PERSISTENCE_PORT)
    private readonly persistence: ReaderEngagementPersistencePort,
  ) {}

  async execute(command: SaveReadingProgressCommand): Promise<ReadingHistoryEntryResultDto> {
    const result = await this.persistence.saveReadingProgress({
      userId: requireReaderUserId(command.userId),
      storyId: command.storyId,
      chapterId: command.chapterId,
      position: Math.max(0, Math.trunc(command.position)),
      readAt: new Date(),
    });

    if (result.status === 'story_not_found') {
      throw new StoryNotFoundException(command.storyId);
    }
    if (result.status === 'chapter_not_found') {
      throw new ChapterNotFoundException(command.chapterId);
    }
    return result.entry;
  }
}
