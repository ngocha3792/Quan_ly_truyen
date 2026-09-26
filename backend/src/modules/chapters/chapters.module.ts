import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { AuthorsModule } from '@/modules/authors';
import { MediaModule } from '@/modules/media';
import { MonetizationModule } from '@/modules/monetization';
import {
  CHAPTER_PERSISTENCE_PORT,
  CreateAuthorChapterCommandHandler,
  ImportAuthorChaptersCommandHandler,
  DeleteAuthorChapterCommandHandler,
  GetAuthorChapterQueryHandler,
  GetAuthorChapterVersionQueryHandler,
  GetPublicChapterReaderQueryHandler,
  ListAuthorChaptersQueryHandler,
  ListAuthorChapterVersionsQueryHandler,
  ListPublicStoryChaptersQueryHandler,
  BulkPublishChaptersCommandHandler,
  PublishAuthorChapterCommandHandler,
  ScheduleAuthorChapterCommandHandler,
  CancelAuthorChapterScheduleCommandHandler,
  UpdateAuthorChapterCommandHandler,
  RestoreAuthorChapterVersionCommandHandler,
  AttachChapterMediaCommandHandler,
  ReorderChapterMediaCommandHandler,
  RemoveChapterMediaCommandHandler,
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
  imports: [
    PrismaModule,
    AuthorsModule,
    MediaModule,
    MonetizationModule,
    ChapterWorkflowModule,
  ],
  controllers: [
    AuthorChaptersController,
    PublicChaptersController,
    AuthorChapterAutosaveController,
  ],
  providers: [
    GetVersionDiffQueryHandler,
    CreateAuthorChapterCommandHandler,
    ImportAuthorChaptersCommandHandler,
    UpdateAuthorChapterCommandHandler,
    DeleteAuthorChapterCommandHandler,
    ListAuthorChaptersQueryHandler,
    GetAuthorChapterQueryHandler,
    GetAuthorChapterVersionQueryHandler,
    ListAuthorChapterVersionsQueryHandler,
    RestoreAuthorChapterVersionCommandHandler,
    BulkPublishChaptersCommandHandler,
    PublishAuthorChapterCommandHandler,
    ScheduleAuthorChapterCommandHandler,
    CancelAuthorChapterScheduleCommandHandler,
    GetPublicChapterReaderQueryHandler,
    ListPublicStoryChaptersQueryHandler,
    AttachChapterMediaCommandHandler,
    ReorderChapterMediaCommandHandler,
    RemoveChapterMediaCommandHandler,
    PrismaChapterPersistence,
    {
      provide: CHAPTER_PERSISTENCE_PORT,
      useExisting: PrismaChapterPersistence,
    },
  ],
  exports: [CHAPTER_PERSISTENCE_PORT],
})
export class ChaptersModule {}
