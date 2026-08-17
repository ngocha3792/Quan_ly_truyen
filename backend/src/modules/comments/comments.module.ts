import { Module } from '@nestjs/common';
import { RedisModule } from '@/infrastructure/cache/redis/redis.module';
import { PrismaModule } from '@/infrastructure/database';
import {
  AbuseRateLimiterService,
  COMMENT_ABUSE_METRICS_PORT,
  COMMENT_ABUSE_RATE_LIMIT_STORE_PORT,
  COMMENT_METRICS_PORT,
  COMMENT_PERSISTENCE_PORT,
  RECENT_COMMENT_READER_PORT,
  CommentsService,
  CommentWriteAbuseService,
  CreateStoryCommentCommandHandler,
  DeleteStoryCommentCommandHandler,
  ListChapterCommentsQueryHandler,
  ListStoryCommentsQueryHandler,
  UpdateStoryCommentCommandHandler,
} from './application';
import {
  MetricsCommentAbuseAdapter,
  MetricsCommentMetricsAdapter,
  PrismaCommentPersistence,
  PrismaRecentCommentReader,
  RedisCommentAbuseRateLimitStoreAdapter,
} from './infrastructure';
import {
  CommentsController,
  CommentWriteController,
  PublicCommentsController,
} from './presentation';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [
    CommentsController,
    CommentWriteController,
    PublicCommentsController,
  ],
  providers: [
    CommentsService,
    AbuseRateLimiterService,
    CommentWriteAbuseService,
    CreateStoryCommentCommandHandler,
    UpdateStoryCommentCommandHandler,
    DeleteStoryCommentCommandHandler,
    ListStoryCommentsQueryHandler,
    ListChapterCommentsQueryHandler,
    PrismaCommentPersistence,
    PrismaRecentCommentReader,
    MetricsCommentMetricsAdapter,
    MetricsCommentAbuseAdapter,
    RedisCommentAbuseRateLimitStoreAdapter,
    {
      provide: COMMENT_PERSISTENCE_PORT,
      useExisting: PrismaCommentPersistence,
    },
    {
      provide: COMMENT_METRICS_PORT,
      useExisting: MetricsCommentMetricsAdapter,
    },
    {
      provide: RECENT_COMMENT_READER_PORT,
      useExisting: PrismaRecentCommentReader,
    },
    {
      provide: COMMENT_ABUSE_RATE_LIMIT_STORE_PORT,
      useExisting: RedisCommentAbuseRateLimitStoreAdapter,
    },
    {
      provide: COMMENT_ABUSE_METRICS_PORT,
      useExisting: MetricsCommentAbuseAdapter,
    },
  ],
  exports: [AbuseRateLimiterService, CommentWriteAbuseService],
})
export class CommentsModule {}
