import { Module } from '@nestjs/common';

import { RedisModule } from '@/infrastructure/cache/redis';
import { PrismaModule } from '@/infrastructure/database';
import { AuthModule } from '@/modules/auth';

import {
  ClearReadingHistoryCommandHandler,
  GetWeeklyReadingStatsQueryHandler,
  GetReadingProgressQueryHandler,
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
  ReadingProgressGateway,
  ReadingProgressRateLimiter,
  ReadingProgressSocketAuthenticator,
} from './infrastructure';
import {
  ReadingBookmarksController,
  ReadingHistoryController,
} from './presentation';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule],
  controllers: [ReadingHistoryController, ReadingBookmarksController],
  providers: [
    ListReadingHistoryQueryHandler,
    GetWeeklyReadingStatsQueryHandler,
    GetReadingProgressQueryHandler,
    SaveReadingProgressCommandHandler,
    RemoveReadingHistoryEntryCommandHandler,
    ClearReadingHistoryCommandHandler,
    ListReadingBookmarksQueryHandler,
    GetReadingBookmarkQueryHandler,
    UpsertReadingBookmarkCommandHandler,
    RemoveReadingBookmarkCommandHandler,
    PrismaReadingHistoryPersistence,
    PrismaReadingBookmarkPersistence,
    ReadingProgressGateway,
    ReadingProgressRateLimiter,
    ReadingProgressSocketAuthenticator,
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
