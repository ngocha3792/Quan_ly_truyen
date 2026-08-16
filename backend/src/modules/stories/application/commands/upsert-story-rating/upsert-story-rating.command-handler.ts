import { Inject, Injectable } from '@nestjs/common';
import {
  InvalidRatingScoreException,
  ReaderEngagementPolicy,
  StoryNotFoundException,
} from '../../../domain';
import type { StoryRatingResultDto } from '../../dto';
import {
  READER_ENGAGEMENT_PERSISTENCE_PORT,
  type ReaderEngagementPersistencePort,
} from '../../ports';
import { requireReaderUserId } from '../../reader-engagement.util';
import { UpsertStoryRatingCommand } from './upsert-story-rating.command';

@Injectable()
export class UpsertStoryRatingCommandHandler {
  constructor(
    @Inject(READER_ENGAGEMENT_PERSISTENCE_PORT)
    private readonly persistence: ReaderEngagementPersistencePort,
  ) {}

  async execute(
    command: UpsertStoryRatingCommand,
  ): Promise<StoryRatingResultDto> {
    if (!ReaderEngagementPolicy.isValidRating(command.score)) {
      throw new InvalidRatingScoreException();
    }

    const result = await this.persistence.upsertRating({
      userId: requireReaderUserId(command.userId),
      storyId: command.storyId,
      score: command.score,
      updatedAt: new Date(),
    });

    if (result.status === 'story_not_found') {
      throw new StoryNotFoundException(command.storyId);
    }
    return result.rating;
  }
}
