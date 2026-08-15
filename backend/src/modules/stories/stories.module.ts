import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  CreateAuthorStoryCommandHandler,
  DeleteAuthorStoryCommandHandler,
  STORY_PERSISTENCE_PORT,
  UpdateAuthorStoryCommandHandler,
} from './application';
import { PrismaStoryPersistence } from './infrastructure';
import { AuthorStoriesController } from './presentation/http';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [AuthorStoriesController],
  providers: [
    CreateAuthorStoryCommandHandler,
    UpdateAuthorStoryCommandHandler,
    DeleteAuthorStoryCommandHandler,
    PrismaStoryPersistence,
    {
      provide: STORY_PERSISTENCE_PORT,
      useExisting: PrismaStoryPersistence,
    },
  ],
})
export class StoriesModule {}
