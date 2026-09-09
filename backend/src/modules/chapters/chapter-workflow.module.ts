import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import {
  CHAPTER_EDIT_SESSION_PORT,
  CHAPTER_WORKFLOW_PORT,
} from './application/ports/chapter-workflow.port';
import { ChapterWorkflowCommandHandler } from './application/commands/chapter-workflow/chapter-workflow.command-handler';
import { ChapterEditSessionCommandHandler } from './application/commands/chapter-edit-session/chapter-edit-session.command-handler';
import { ChapterWorkflowQueryHandler } from './application/queries/chapter-workflow/chapter-workflow.query-handler';
import { PrismaChapterWorkflowPersistence } from './infrastructure/persistence/prisma-chapter-workflow.persistence';
import { PrismaChapterEditSessionPersistence } from './infrastructure/persistence/prisma-chapter-edit-session.persistence';
import { AuthorChapterWorkflowController } from './presentation/http/controllers/author-chapter-workflow.controller';
import { AdminChapterReviewsController } from './presentation/http/controllers/admin-chapter-reviews.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AuthorChapterWorkflowController, AdminChapterReviewsController],
  providers: [
    ChapterWorkflowCommandHandler,
    ChapterWorkflowQueryHandler,
    ChapterEditSessionCommandHandler,
    PrismaChapterWorkflowPersistence,
    PrismaChapterEditSessionPersistence,
    {
      provide: CHAPTER_WORKFLOW_PORT,
      useExisting: PrismaChapterWorkflowPersistence,
    },
    {
      provide: CHAPTER_EDIT_SESSION_PORT,
      useExisting: PrismaChapterEditSessionPersistence,
    },
  ],
})
export class ChapterWorkflowModule {}
