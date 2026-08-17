import { Module } from '@nestjs/common';
import { RedisModule } from '@/infrastructure/cache/redis/redis.module';
import { PrismaModule } from '@/infrastructure/database';
import {
  AbuseRateLimiterService,
  COMMENT_METRICS_PORT,
  COMMENT_PERSISTENCE_PORT,
  CommentsService,
  CommentWriteAbuseService,
  CreateStoryCommentCommandHandler,
  DeleteStoryCommentCommandHandler,
  ListChapterCommentsQueryHandler,
  ListStoryCommentsQueryHandler,
  UpdateStoryCommentCommandHandler,
} from './application';
import {
  MetricsCommentMetricsAdapter,
  PrismaCommentPersistence,
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
    MetricsCommentMetricsAdapter,
    {
      provide: COMMENT_PERSISTENCE_PORT,
      useExisting: PrismaCommentPersistence,
    },
    {
      provide: COMMENT_METRICS_PORT,
      useExisting: MetricsCommentMetricsAdapter,
    },
  ],
  exports: [AbuseRateLimiterService, CommentWriteAbuseService],
})
export class CommentsModule {}
