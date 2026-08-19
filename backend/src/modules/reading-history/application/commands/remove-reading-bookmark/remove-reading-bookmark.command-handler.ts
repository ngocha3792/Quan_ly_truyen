import { Inject, Injectable } from '@nestjs/common';

import { requireReadingHistoryUserId } from '../../../domain/policies/reading-history-auth.policy';
import {
  READING_BOOKMARK_PERSISTENCE_PORT,
  type ReadingBookmarkPersistencePort,
} from '../../ports';
import { RemoveReadingBookmarkCommand } from './remove-reading-bookmark.command';

@Injectable()
export class RemoveReadingBookmarkCommandHandler {
  constructor(
    @Inject(READING_BOOKMARK_PERSISTENCE_PORT)
    private readonly persistence: ReadingBookmarkPersistencePort,
  ) {}

  async execute(command: RemoveReadingBookmarkCommand): Promise<void> {
    await this.persistence.removeMine(
      requireReadingHistoryUserId(command.userId),
      command.chapterId,
    );
  }
}
