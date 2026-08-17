import { Inject, Injectable } from '@nestjs/common';

import {
  READING_HISTORY_PERSISTENCE_PORT,
  type ReadingHistoryPersistencePort,
} from '../../ports';
import { requireReadingHistoryUserId } from '../../../domain/policies/reading-history-auth.policy';
import { RemoveReadingHistoryEntryCommand } from './remove-reading-history-entry.command';

@Injectable()
export class RemoveReadingHistoryEntryCommandHandler {
  constructor(
    @Inject(READING_HISTORY_PERSISTENCE_PORT)
    private readonly persistence: ReadingHistoryPersistencePort,
  ) {}

  async execute(command: RemoveReadingHistoryEntryCommand): Promise<void> {
    await this.persistence.removeMine(
      requireReadingHistoryUserId(command.userId),
      command.storyId,
    );
  }
}
