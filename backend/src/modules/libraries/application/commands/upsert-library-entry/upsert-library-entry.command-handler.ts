import { Inject, Injectable } from '@nestjs/common';

import { LibraryStoryNotFoundException } from '../../../domain';
import type { LibraryEntryResultDto } from '../../dto';
import { requireLibraryUserId } from '../../library-auth.util';
import {
  LIBRARY_PERSISTENCE_PORT,
  type LibraryPersistencePort,
} from '../../ports';
import { UpsertLibraryEntryCommand } from './upsert-library-entry.command';

@Injectable()
export class UpsertLibraryEntryCommandHandler {
  constructor(
    @Inject(LIBRARY_PERSISTENCE_PORT)
    private readonly persistence: LibraryPersistencePort,
  ) {}

  async execute(
    command: UpsertLibraryEntryCommand,
  ): Promise<LibraryEntryResultDto> {
    const result = await this.persistence.upsert({
      userId: requireLibraryUserId(command.userId),
      storyId: command.storyId,
      status: command.status,
      isFavorite: command.isFavorite,
      updatedAt: new Date(),
    });

    if (result.status === 'story_not_found') {
      throw new LibraryStoryNotFoundException(command.storyId);
    }

    return result.entry;
  }
}
