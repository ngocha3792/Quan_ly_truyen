import { Module } from '@nestjs/common';

import { RedisModule } from '@/infrastructure/cache/redis/redis.module';
import { PrismaModule } from '@/infrastructure/database';

import {
  COMMENT_ABUSE_GUARD_PORT,
  COMMENT_ABUSE_METRICS_PORT,
  COMMENT_ABUSE_RATE_LIMIT_STORE_PORT,
  COMMENT_INTERACTION_PERSISTENCE_PORT,
  COMMENT_METRICS_PORT,
  COMMENT_PERSISTENCE_PORT,
  COMMENT_WRITE_GUARD_PORT,
  RECENT_COMMENT_READER_PORT,
  ClearCommentReactionCommandHandler,
  CreateCommentReplyCommandHandler,
  CreateCommentReportCommandHandler,
  CreateStoryCommentCommandHandler,
  DeleteStoryCommentCommandHandler,
  GetViewerCommentReactionsQueryHandler,
  ListChapterCommentsQueryHandler,
  ListCommentRepliesQueryHandler,
  ListStoryCommentsQueryHandler,
  SetCommentReactionCommandHandler,
  UpdateStoryCommentCommandHandler,
} from './application';
import {
  CommentWriteGuardAdapter,
  MetricsCommentAbuseAdapter,
  MetricsCommentMetricsAdapter,
  PrismaCommentInteractionPersistence,
  PrismaCommentPersistence,
  PrismaRecentCommentReader,
  RedisCommentAbuseGuardAdapter,
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
    CreateStoryCommentCommandHandler,
    CreateCommentReplyCommandHandler,
    SetCommentReactionCommandHandler,
    ClearCommentReactionCommandHandler,
    CreateCommentReportCommandHandler,
    DeleteStoryCommentCommandHandler,
    UpdateStoryCommentCommandHandler,
    ListCommentRepliesQueryHandler,
    GetViewerCommentReactionsQueryHandler,
    ListStoryCommentsQueryHandler,
    ListChapterCommentsQueryHandler,
    PrismaCommentPersistence,
    PrismaCommentInteractionPersistence,
    PrismaRecentCommentReader,
    RedisCommentAbuseGuardAdapter,
    RedisCommentAbuseRateLimitStoreAdapter,
    CommentWriteGuardAdapter,
    MetricsCommentMetricsAdapter,
    MetricsCommentAbuseAdapter,
    {
      provide: COMMENT_PERSISTENCE_PORT,
      useExisting: PrismaCommentPersistence,
    },
    {
      provide: COMMENT_INTERACTION_PERSISTENCE_PORT,
      useExisting: PrismaCommentInteractionPersistence,
    },
    {
      provide: COMMENT_ABUSE_GUARD_PORT,
      useExisting: RedisCommentAbuseGuardAdapter,
    },
    {
      provide: COMMENT_WRITE_GUARD_PORT,
      useExisting: CommentWriteGuardAdapter,
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
})
export class CommentsModule {}
