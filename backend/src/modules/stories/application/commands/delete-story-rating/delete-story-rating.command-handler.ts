import { Inject, Injectable } from '@nestjs/common';
import {
  READER_ENGAGEMENT_PERSISTENCE_PORT,
  type ReaderEngagementPersistencePort,
} from '../../ports';
import { requireReaderUserId } from '../../reader-engagement.util';
import { DeleteStoryRatingCommand } from './delete-story-rating.command';

@Injectable()
export class DeleteStoryRatingCommandHandler {
  constructor(
    @Inject(READER_ENGAGEMENT_PERSISTENCE_PORT)
    private readonly persistence: ReaderEngagementPersistencePort,
  ) {}

  async execute(command: DeleteStoryRatingCommand): Promise<void> {
    await this.persistence.deleteRating(
      requireReaderUserId(command.userId),
      command.storyId,
    );
  }
}
