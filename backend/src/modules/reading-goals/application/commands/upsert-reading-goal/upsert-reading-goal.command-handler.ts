import { Inject, Injectable } from '@nestjs/common';

import {
  InvalidReadingGoalTargetException,
  ReadingGoalPolicy,
} from '../../../domain';
import type { ReadingGoalResultDto } from '../../dto';
import {
  READING_GOAL_PERSISTENCE_PORT,
  type ReadingGoalPersistencePort,
} from '../../ports';
import { requireReadingGoalUserId } from '../../../domain/policies/reading-goal-auth.policy';
import { UpsertReadingGoalCommand } from './upsert-reading-goal.command';

@Injectable()
export class UpsertReadingGoalCommandHandler {
  constructor(
    @Inject(READING_GOAL_PERSISTENCE_PORT)
    private readonly persistence: ReadingGoalPersistencePort,
  ) {}

  execute(command: UpsertReadingGoalCommand): Promise<ReadingGoalResultDto> {
    if (!ReadingGoalPolicy.isValidTarget(command.targetChapters)) {
      throw new InvalidReadingGoalTargetException();
    }

    return this.persistence.upsert(
      requireReadingGoalUserId(command.userId),
      command.targetChapters,
    );
  }
}
