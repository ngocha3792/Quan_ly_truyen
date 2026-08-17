import { Inject, Injectable } from '@nestjs/common';

import {
  RATING_PERSISTENCE_PORT,
  type RatingPersistencePort,
} from '../../ports';
import { requireRatingUserId } from '../../../domain/policies/rating-auth.policy';
import { DeleteRatingCommand } from './delete-rating.command';

@Injectable()
export class DeleteRatingCommandHandler {
  constructor(
    @Inject(RATING_PERSISTENCE_PORT)
    private readonly persistence: RatingPersistencePort,
  ) {}

  async execute(command: DeleteRatingCommand): Promise<void> {
    await this.persistence.deleteMine(
      requireRatingUserId(command.userId),
      command.storyId,
    );
  }
}
