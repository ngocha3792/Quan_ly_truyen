import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { AuthorsModule } from '@/modules/authors';
import { MediaModule } from '@/modules/media';
import {
  CHAPTER_PERSISTENCE_PORT,
  CreateAuthorChapterCommandHandler,
  DeleteAuthorChapterCommandHandler,
  GetAuthorChapterQueryHandler,
  GetAuthorChapterVersionQueryHandler,
  GetPublicChapterReaderQueryHandler,
  ListAuthorChaptersQueryHandler,
  ListAuthorChapterVersionsQueryHandler,
  ListPublicStoryChaptersQueryHandler,
  PublishAuthorChapterCommandHandler,
  ScheduleAuthorChapterCommandHandler,
  CancelAuthorChapterScheduleCommandHandler,
  UpdateAuthorChapterCommandHandler,
  RestoreAuthorChapterVersionCommandHandler,
} from './application';
import { PrismaChapterPersistence } from './infrastructure';
import { GetVersionDiffQueryHandler } from './application/queries/get-version-diff/get-version-diff.query-handler';
import { AuthorChapterAutosaveController } from './presentation/http/controllers/author-chapter-autosave.controller';
import { ChapterWorkflowModule } from './chapter-workflow.module';
import {
  AuthorChaptersController,
  PublicChaptersController,
} from './presentation';

@Module({
  imports: [PrismaModule, AuthorsModule, MediaModule, ChapterWorkflowModule],
  controllers: [
    AuthorChaptersController,
    PublicChaptersController,
    AuthorChapterAutosaveController,
  ],
  providers: [
    GetVersionDiffQueryHandler,
    CreateAuthorChapterCommandHandler,
    UpdateAuthorChapterCommandHandler,
    DeleteAuthorChapterCommandHandler,
    ListAuthorChaptersQueryHandler,
    GetAuthorChapterQueryHandler,
    GetAuthorChapterVersionQueryHandler,
    ListAuthorChapterVersionsQueryHandler,
    RestoreAuthorChapterVersionCommandHandler,
    PublishAuthorChapterCommandHandler,
    ScheduleAuthorChapterCommandHandler,
    CancelAuthorChapterScheduleCommandHandler,
    GetPublicChapterReaderQueryHandler,
    ListPublicStoryChaptersQueryHandler,
    PrismaChapterPersistence,
    {
      provide: CHAPTER_PERSISTENCE_PORT,
      useExisting: PrismaChapterPersistence,
    },
  ],
  exports: [CHAPTER_PERSISTENCE_PORT],
})
export class ChaptersModule {}
