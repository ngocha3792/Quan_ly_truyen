import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  ClearReadingHistoryCommandHandler,
  ListReadingHistoryQueryHandler,
  READING_HISTORY_PERSISTENCE_PORT,
  RemoveReadingHistoryEntryCommandHandler,
  SaveReadingProgressCommandHandler,
} from './application';
import { PrismaReadingHistoryPersistence } from './infrastructure';
import { ReadingHistoryController } from './presentation';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [ReadingHistoryController],
  providers: [
    ListReadingHistoryQueryHandler,
    SaveReadingProgressCommandHandler,
    RemoveReadingHistoryEntryCommandHandler,
    ClearReadingHistoryCommandHandler,
    PrismaReadingHistoryPersistence,
    {
      provide: READING_HISTORY_PERSISTENCE_PORT,
      useExisting: PrismaReadingHistoryPersistence,
    },
  ],
})
export class ReadingHistoryModule {}
