import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { AuthorsModule } from '@/modules/authors';
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
import {
  AuthorChaptersController,
  PublicChaptersController,
} from './presentation';

@Module({
  imports: [PrismaModule, AuthorsModule],
  controllers: [AuthorChaptersController, PublicChaptersController],
  providers: [
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
