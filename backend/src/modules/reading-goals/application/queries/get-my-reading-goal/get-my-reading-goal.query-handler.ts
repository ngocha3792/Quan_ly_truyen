import { Inject, Injectable } from '@nestjs/common';

import type { ReadingGoalResultDto } from '../../dto';
import {
  READING_GOAL_PERSISTENCE_PORT,
  type ReadingGoalPersistencePort,
} from '../../ports';
import { requireReadingGoalUserId } from '../../../domain/policies/reading-goal-auth.policy';
import { GetMyReadingGoalQuery } from './get-my-reading-goal.query';

@Injectable()
export class GetMyReadingGoalQueryHandler {
  constructor(
    @Inject(READING_GOAL_PERSISTENCE_PORT)
    private readonly persistence: ReadingGoalPersistencePort,
  ) {}

  execute(query: GetMyReadingGoalQuery): Promise<ReadingGoalResultDto> {
    return this.persistence.findMine(requireReadingGoalUserId(query.userId));
  }
}
