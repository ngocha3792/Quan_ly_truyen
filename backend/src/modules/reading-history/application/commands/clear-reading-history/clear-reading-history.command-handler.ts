import { Inject, Injectable } from '@nestjs/common';

import {
  READING_HISTORY_PERSISTENCE_PORT,
  type ReadingHistoryPersistencePort,
} from '../../ports';
import { requireReadingHistoryUserId } from '../../../domain/policies/reading-history-auth.policy';
import { ClearReadingHistoryCommand } from './clear-reading-history.command';

@Injectable()
export class ClearReadingHistoryCommandHandler {
  constructor(
    @Inject(READING_HISTORY_PERSISTENCE_PORT)
    private readonly persistence: ReadingHistoryPersistencePort,
  ) {}

  async execute(command: ClearReadingHistoryCommand): Promise<void> {
    await this.persistence.clearMine(requireReadingHistoryUserId(command.userId));
  }
}
