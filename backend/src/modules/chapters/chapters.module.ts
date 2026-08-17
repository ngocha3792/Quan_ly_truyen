import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { AuthorsModule } from '@/modules/authors';
import {
  CHAPTER_PERSISTENCE_PORT,
  CreateAuthorChapterCommandHandler,
  DeleteAuthorChapterCommandHandler,
  GetAuthorChapterQueryHandler,
  GetPublicChapterReaderQueryHandler,
  ListAuthorChaptersQueryHandler,
  PublishAuthorChapterCommandHandler,
  UpdateAuthorChapterCommandHandler,
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
    PublishAuthorChapterCommandHandler,
    GetPublicChapterReaderQueryHandler,
    PrismaChapterPersistence,
    {
      provide: CHAPTER_PERSISTENCE_PORT,
      useExisting: PrismaChapterPersistence,
    },
  ],
  exports: [CHAPTER_PERSISTENCE_PORT],
})
export class ChaptersModule {}
