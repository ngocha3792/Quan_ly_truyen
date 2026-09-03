import type { ReadingGoalResultDto } from '../dto';

export const READING_GOAL_PERSISTENCE_PORT = Symbol(
  'READING_GOAL_PERSISTENCE_PORT',
);

export interface ReadingGoalPersistencePort {
  findMine(userId: string): Promise<ReadingGoalResultDto>;

  upsert(userId: string, targetChapters: number): Promise<ReadingGoalResultDto>;
}
