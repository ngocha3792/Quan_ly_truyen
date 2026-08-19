import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  ClearReadingHistoryCommandHandler,
  GetReadingBookmarkQueryHandler,
  ListReadingBookmarksQueryHandler,
  ListReadingHistoryQueryHandler,
  READING_BOOKMARK_PERSISTENCE_PORT,
  READING_HISTORY_PERSISTENCE_PORT,
  RemoveReadingBookmarkCommandHandler,
  RemoveReadingHistoryEntryCommandHandler,
  SaveReadingProgressCommandHandler,
  UpsertReadingBookmarkCommandHandler,
} from './application';
import {
  PrismaReadingBookmarkPersistence,
  PrismaReadingHistoryPersistence,
} from './infrastructure';
import {
  ReadingBookmarksController,
  ReadingHistoryController,
} from './presentation';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [ReadingHistoryController, ReadingBookmarksController],
  providers: [
    ListReadingHistoryQueryHandler,
    SaveReadingProgressCommandHandler,
    RemoveReadingHistoryEntryCommandHandler,
    ClearReadingHistoryCommandHandler,
    ListReadingBookmarksQueryHandler,
    GetReadingBookmarkQueryHandler,
    UpsertReadingBookmarkCommandHandler,
    RemoveReadingBookmarkCommandHandler,
    PrismaReadingHistoryPersistence,
    PrismaReadingBookmarkPersistence,
    {
      provide: READING_HISTORY_PERSISTENCE_PORT,
      useExisting: PrismaReadingHistoryPersistence,
    },
    {
      provide: READING_BOOKMARK_PERSISTENCE_PORT,
      useExisting: PrismaReadingBookmarkPersistence,
    },
  ],
})
export class ReadingHistoryModule {}
