import { Inject, Injectable } from '@nestjs/common';
import {
  READER_ENGAGEMENT_PERSISTENCE_PORT,
  type ReaderEngagementPersistencePort,
} from '../../ports';
import { requireReaderUserId } from '../../reader-engagement.util';
import { RemoveReadingHistoryEntryCommand } from './remove-reading-history-entry.command';

@Injectable()
export class RemoveReadingHistoryEntryCommandHandler {
  constructor(
    @Inject(READER_ENGAGEMENT_PERSISTENCE_PORT)
    private readonly persistence: ReaderEngagementPersistencePort,
  ) {}

  async execute(command: RemoveReadingHistoryEntryCommand): Promise<void> {
    await this.persistence.removeReadingHistoryEntry(
      requireReaderUserId(command.userId),
      command.storyId,
    );
  }
}
