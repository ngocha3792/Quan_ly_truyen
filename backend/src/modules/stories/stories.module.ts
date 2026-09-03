import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import { AuthorsModule } from '@/modules/authors';

import {
  ApproveStorySubmissionCommandHandler,
  CancelAuthorStorySubmissionCommandHandler,
  CreateAuthorStoryCommandHandler,
  DeleteAuthorStoryCommandHandler,
  GetAuthorStoryQueryHandler,
  GetPublicStoryDetailQueryHandler,
  ListAuthorStoriesQueryHandler,
  ListPublicStoriesQueryHandler,
  ListStoryCategoriesQueryHandler,
  ListStoryTagsQueryHandler,
  RejectStorySubmissionCommandHandler,
  STORY_MODERATION_READER_PORT,
  STORY_PERSISTENCE_PORT,
  STORY_CONTRIBUTOR_PERSISTENCE_PORT,
  StoryContributorUseCases,
  SubmitAuthorStoryCommandHandler,
  UpdateAuthorStoryCommandHandler,
} from './application';
import {
  PrismaStoryModerationReader,
  PrismaStoryPersistence,
  PrismaStoryContributorPersistence,
} from './infrastructure';
import {
  AdminStoryModerationController,
  AdminStoryPublicationController,
  AuthorStoriesController,
  AuthorStoryContributorsController,
  PublicStoriesController,
  StoryMetadataController,
} from './presentation/http';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule, AuthorsModule],
  controllers: [
    PublicStoriesController,
    AuthorStoriesController,
    AuthorStoryContributorsController,
    StoryMetadataController,
    AdminStoryModerationController,
    AdminStoryPublicationController,
  ],
  providers: [
    CreateAuthorStoryCommandHandler,
    UpdateAuthorStoryCommandHandler,
    DeleteAuthorStoryCommandHandler,
    ListAuthorStoriesQueryHandler,
    GetAuthorStoryQueryHandler,
    SubmitAuthorStoryCommandHandler,
    CancelAuthorStorySubmissionCommandHandler,
    ApproveStorySubmissionCommandHandler,
    RejectStorySubmissionCommandHandler,
    ListPublicStoriesQueryHandler,
    GetPublicStoryDetailQueryHandler,
    ListStoryCategoriesQueryHandler,
    ListStoryTagsQueryHandler,
    PrismaStoryPersistence,
    PrismaStoryContributorPersistence,
    StoryContributorUseCases,
    PrismaStoryModerationReader,
    {
      provide: STORY_PERSISTENCE_PORT,
      useExisting: PrismaStoryPersistence,
    },
    {
      provide: STORY_MODERATION_READER_PORT,
      useExisting: PrismaStoryModerationReader,
    },
    {
      provide: STORY_CONTRIBUTOR_PERSISTENCE_PORT,
      useExisting: PrismaStoryContributorPersistence,
    },
  ],
})
export class StoriesModule {}
