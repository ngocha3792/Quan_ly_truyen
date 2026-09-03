import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  GetMyReadingGoalQueryHandler,
  READING_GOAL_PERSISTENCE_PORT,
  UpsertReadingGoalCommandHandler,
} from './application';
import { PrismaReadingGoalPersistence } from './infrastructure';
import { ReadingGoalsController } from './presentation';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [ReadingGoalsController],
  providers: [
    GetMyReadingGoalQueryHandler,
    UpsertReadingGoalCommandHandler,
    PrismaReadingGoalPersistence,
    {
      provide: READING_GOAL_PERSISTENCE_PORT,
      useExisting: PrismaReadingGoalPersistence,
    },
  ],
})
export class ReadingGoalsModule {}
