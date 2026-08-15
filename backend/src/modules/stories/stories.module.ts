import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  CHAPTER_PERSISTENCE_PORT,
  CreateAuthorChapterCommandHandler,
  CreateAuthorStoryCommandHandler,
  DeleteAuthorChapterCommandHandler,
  DeleteAuthorStoryCommandHandler,
  ListStoryCategoriesQueryHandler,
  ListStoryTagsQueryHandler,
  STORY_PERSISTENCE_PORT,
  UpdateAuthorChapterCommandHandler,
  UpdateAuthorStoryCommandHandler,
} from './application';
import {
  PrismaChapterPersistence,
  PrismaStoryPersistence,
} from './infrastructure';
import {
  AuthorChaptersController,
  AuthorStoriesController,
  StoryMetadataController,
} from './presentation/http';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [
    AuthorStoriesController,
    AuthorChaptersController,
    StoryMetadataController,
  ],
  providers: [
    CreateAuthorStoryCommandHandler,
    UpdateAuthorStoryCommandHandler,
    DeleteAuthorStoryCommandHandler,
    CreateAuthorChapterCommandHandler,
    UpdateAuthorChapterCommandHandler,
    DeleteAuthorChapterCommandHandler,
    ListStoryCategoriesQueryHandler,
    ListStoryTagsQueryHandler,
    PrismaStoryPersistence,
    PrismaChapterPersistence,
    {
      provide: STORY_PERSISTENCE_PORT,
      useExisting: PrismaStoryPersistence,
    },
    {
      provide: CHAPTER_PERSISTENCE_PORT,
      useExisting: PrismaChapterPersistence,
    },
  ],
})
export class StoriesModule {}
