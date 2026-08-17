import { Inject, Injectable } from '@nestjs/common';

import {
  InvalidRatingScoreException,
  RatedStoryNotFoundException,
  RatingPolicy,
} from '../../../domain';
import type { StoryRatingResultDto } from '../../dto';
import {
  RATING_PERSISTENCE_PORT,
  type RatingPersistencePort,
} from '../../ports';
import { requireRatingUserId } from '../../../domain/policies/rating-auth.policy';
import { UpsertRatingCommand } from './upsert-rating.command';

@Injectable()
export class UpsertRatingCommandHandler {
  constructor(
    @Inject(RATING_PERSISTENCE_PORT)
    private readonly persistence: RatingPersistencePort,
  ) {}

  async execute(command: UpsertRatingCommand): Promise<StoryRatingResultDto> {
    if (!RatingPolicy.isValidScore(command.score)) {
      throw new InvalidRatingScoreException();
    }

    const result = await this.persistence.upsert({
      userId: requireRatingUserId(command.userId),
      storyId: command.storyId,
      score: command.score,
      updatedAt: new Date(),
    });

    if (result.status === 'story_not_found') {
      throw new RatedStoryNotFoundException(command.storyId);
    }

    return result.rating;
  }
}
