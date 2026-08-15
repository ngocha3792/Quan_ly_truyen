import { Inject, Injectable } from '@nestjs/common';

import { StoryNotFoundException } from '../../../domain';
import type { LibraryEntryResultDto } from '../../dto';
import {
  READER_ENGAGEMENT_PERSISTENCE_PORT,
  type ReaderEngagementPersistencePort,
} from '../../ports';
import { requireReaderUserId } from '../../reader-engagement.util';
import { UpsertLibraryEntryCommand } from './upsert-library-entry.command';

@Injectable()
export class UpsertLibraryEntryCommandHandler {
  constructor(
    @Inject(READER_ENGAGEMENT_PERSISTENCE_PORT)
    private readonly persistence: ReaderEngagementPersistencePort,
  ) {}

  async execute(command: UpsertLibraryEntryCommand): Promise<LibraryEntryResultDto> {
    const result = await this.persistence.upsertLibraryEntry({
      userId: requireReaderUserId(command.userId),
      storyId: command.storyId,
      status: command.status,
      isFavorite: command.isFavorite,
      updatedAt: new Date(),
    });

    if (result.status === 'story_not_found') {
      throw new StoryNotFoundException(command.storyId);
    }

    return result.entry;
  }
}
