import { Module } from '@nestjs/common';
import { RedisModule } from '@/infrastructure/cache/redis/redis.module';
import { PrismaModule } from '@/infrastructure/database';
import { AnalyticsIdentityService } from './application/analytics-identity.service';
import { AnalyticsRateLimiterService } from './application/analytics-rate-limiter.service';
import { ReaderAnalyticsIngestionService } from './application/reader-analytics-ingestion.service';
import { AuthorAnalyticsService } from './application/author-analytics.service';
import { ReaderAnalyticsController } from './presentation/http/reader-analytics.controller';
import { AuthorAnalyticsController } from './presentation/http/author-analytics.controller';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [ReaderAnalyticsController, AuthorAnalyticsController],
  providers: [
    AnalyticsIdentityService,
    AnalyticsRateLimiterService,
    ReaderAnalyticsIngestionService,
    AuthorAnalyticsService,
  ],
  exports: [AnalyticsIdentityService],
})
export class AnalyticsModule {}
