import { Module } from '@nestjs/common';
import { RedisModule } from '@/infrastructure/cache/redis/redis.module';
import { PrismaModule } from '@/infrastructure/database';
import {
  ANALYTICS_IDENTITY_PORT,
  AUTHOR_ANALYTICS_READER_PORT,
  READER_ANALYTICS_INGESTION_PORT,
  GetAuthorAnalyticsOverviewQueryHandler,
  GetAuthorStoryAnalyticsQueryHandler,
  IngestReaderAnalyticsCommandHandler,
  ListAuthorStoryAnalyticsQueryHandler,
} from './application';
import {
  HmacAnalyticsIdentityAdapter,
  PrismaAuthorAnalyticsReader,
  PrismaReaderAnalyticsIngestionAdapter,
  RedisAnalyticsRateLimitAdapter,
} from './infrastructure';
import { AuthorAnalyticsController, ReaderAnalyticsController } from './presentation/http/controllers';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [ReaderAnalyticsController, AuthorAnalyticsController],
  providers: [
    HmacAnalyticsIdentityAdapter,
    RedisAnalyticsRateLimitAdapter,
    PrismaReaderAnalyticsIngestionAdapter,
    PrismaAuthorAnalyticsReader,
    IngestReaderAnalyticsCommandHandler,
    GetAuthorAnalyticsOverviewQueryHandler,
    ListAuthorStoryAnalyticsQueryHandler,
    GetAuthorStoryAnalyticsQueryHandler,
    { provide: ANALYTICS_IDENTITY_PORT, useExisting: HmacAnalyticsIdentityAdapter },
    { provide: READER_ANALYTICS_INGESTION_PORT, useExisting: PrismaReaderAnalyticsIngestionAdapter },
    { provide: AUTHOR_ANALYTICS_READER_PORT, useExisting: PrismaAuthorAnalyticsReader },
  ],
  exports: [ANALYTICS_IDENTITY_PORT],
})
export class AnalyticsModule {}
