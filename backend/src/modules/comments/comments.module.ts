import { Module } from '@nestjs/common';
import { RedisModule } from '@/infrastructure/cache/redis/redis.module';
import { PrismaModule } from '@/infrastructure/database';
import {
  AbuseRateLimiterService,
  CommentsService,
  CommentWriteAbuseService,
} from './application';
import { CommentsController } from './presentation/http/comments.controller';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [CommentsController],
  providers: [
    CommentsService,
    AbuseRateLimiterService,
    CommentWriteAbuseService,
  ],
  exports: [AbuseRateLimiterService, CommentWriteAbuseService],
})
export class CommentsModule {}
