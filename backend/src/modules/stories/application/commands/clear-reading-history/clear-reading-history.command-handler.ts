import { Inject, Injectable } from '@nestjs/common';
import {
  READER_ENGAGEMENT_PERSISTENCE_PORT,
  type ReaderEngagementPersistencePort,
} from '../../ports';
import { requireReaderUserId } from '../../reader-engagement.util';
import { ClearReadingHistoryCommand } from './clear-reading-history.command';

@Injectable()
export class ClearReadingHistoryCommandHandler {
  constructor(
    @Inject(READER_ENGAGEMENT_PERSISTENCE_PORT)
    private readonly persistence: ReaderEngagementPersistencePort,
  ) {}

  async execute(command: ClearReadingHistoryCommand): Promise<void> {
    await this.persistence.clearReadingHistory(requireReaderUserId(command.userId));
  }
}
