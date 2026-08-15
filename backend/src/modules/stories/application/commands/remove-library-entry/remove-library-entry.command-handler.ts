import { Inject, Injectable } from '@nestjs/common';

import {
  READER_ENGAGEMENT_PERSISTENCE_PORT,
  type ReaderEngagementPersistencePort,
} from '../../ports';
import { requireReaderUserId } from '../../reader-engagement.util';
import { RemoveLibraryEntryCommand } from './remove-library-entry.command';

@Injectable()
export class RemoveLibraryEntryCommandHandler {
  constructor(
    @Inject(READER_ENGAGEMENT_PERSISTENCE_PORT)
    private readonly persistence: ReaderEngagementPersistencePort,
  ) {}

  async execute(command: RemoveLibraryEntryCommand): Promise<void> {
    await this.persistence.removeLibraryEntry(
      requireReaderUserId(command.userId),
      command.storyId,
    );
  }
}
