import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  ApproveStorySubmissionCommandHandler,
  CancelAuthorStorySubmissionCommandHandler,
  CHAPTER_PERSISTENCE_PORT,
  CreateAuthorChapterCommandHandler,
  CreateAuthorStoryCommandHandler,
  DeleteAuthorChapterCommandHandler,
  DeleteAuthorStoryCommandHandler,
  GetPublicStoryDetailQueryHandler,
  ListPublicStoriesQueryHandler,
  ListStoryCategoriesQueryHandler,
  ListStoryTagsQueryHandler,
  PublishAuthorChapterCommandHandler,
  RejectStorySubmissionCommandHandler,
  STORY_PERSISTENCE_PORT,
  SubmitAuthorStoryCommandHandler,
  UpdateAuthorChapterCommandHandler,
  UpdateAuthorStoryCommandHandler,
} from './application';
import {
  PrismaChapterPersistence,
  PrismaStoryPersistence,
} from './infrastructure';
import {
  AdminStoryPublicationController,
  AuthorChaptersController,
  AuthorStoriesController,
  PublicStoriesController,
  StoryMetadataController,
} from './presentation/http';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [
    PublicStoriesController,
    AuthorStoriesController,
    AuthorChaptersController,
    StoryMetadataController,
    AdminStoryPublicationController,
  ],
  providers: [
    CreateAuthorStoryCommandHandler,
    UpdateAuthorStoryCommandHandler,
    DeleteAuthorStoryCommandHandler,
    CreateAuthorChapterCommandHandler,
    UpdateAuthorChapterCommandHandler,
    DeleteAuthorChapterCommandHandler,
    PublishAuthorChapterCommandHandler,
    SubmitAuthorStoryCommandHandler,
    CancelAuthorStorySubmissionCommandHandler,
    ApproveStorySubmissionCommandHandler,
    RejectStorySubmissionCommandHandler,
    ListPublicStoriesQueryHandler,
    GetPublicStoryDetailQueryHandler,
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
