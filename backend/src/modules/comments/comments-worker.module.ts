import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { CommentReanchorScheduler } from './infrastructure';

@Module({ imports: [PrismaModule], providers: [CommentReanchorScheduler] })
export class CommentsWorkerModule {}
