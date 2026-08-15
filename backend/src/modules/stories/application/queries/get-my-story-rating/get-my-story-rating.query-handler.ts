import { Inject, Injectable } from '@nestjs/common';
import type { StoryRatingResultDto } from '../../dto';
import {
  READER_ENGAGEMENT_PERSISTENCE_PORT,
  type ReaderEngagementPersistencePort,
} from '../../ports';
import { requireReaderUserId } from '../../reader-engagement.util';
import { GetMyStoryRatingQuery } from './get-my-story-rating.query';

@Injectable()
export class GetMyStoryRatingQueryHandler {
  constructor(
    @Inject(READER_ENGAGEMENT_PERSISTENCE_PORT)
    private readonly persistence: ReaderEngagementPersistencePort,
  ) {}

  execute(query: GetMyStoryRatingQuery): Promise<StoryRatingResultDto | null> {
    return this.persistence.findMyRating(
      requireReaderUserId(query.userId),
      query.storyId,
    );
  }
}
