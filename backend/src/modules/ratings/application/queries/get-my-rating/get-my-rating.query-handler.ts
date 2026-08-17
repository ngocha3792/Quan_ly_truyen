import { Inject, Injectable } from '@nestjs/common';

import type { StoryRatingResultDto } from '../../dto';
import {
  RATING_PERSISTENCE_PORT,
  type RatingPersistencePort,
} from '../../ports';
import { requireRatingUserId } from '../../rating-auth.util';
import { GetMyRatingQuery } from './get-my-rating.query';

@Injectable()
export class GetMyRatingQueryHandler {
  constructor(
    @Inject(RATING_PERSISTENCE_PORT)
    private readonly persistence: RatingPersistencePort,
  ) {}

  execute(query: GetMyRatingQuery): Promise<StoryRatingResultDto | null> {
    return this.persistence.findMine(
      requireRatingUserId(query.userId),
      query.storyId,
    );
  }
}
