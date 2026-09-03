import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  FOLLOW_REPOSITORY,
  FollowAuthorCommandHandler,
  FollowStoryCommandHandler,
  GetStoryFollowQueryHandler,
  ListFollowingQueryHandler,
  ListStoryFollowsQueryHandler,
  UnfollowAuthorCommandHandler,
  UnfollowStoryCommandHandler,
} from './application';
import { PrismaFollowRepository } from './infrastructure';
import { AuthorFollowController } from './presentation/http/controllers';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [AuthorFollowController],
  providers: [
    FollowAuthorCommandHandler,
    UnfollowAuthorCommandHandler,
    ListFollowingQueryHandler,
    FollowStoryCommandHandler,
    UnfollowStoryCommandHandler,
    GetStoryFollowQueryHandler,
    ListStoryFollowsQueryHandler,
    PrismaFollowRepository,
    { provide: FOLLOW_REPOSITORY, useExisting: PrismaFollowRepository },
  ],
})
export class FollowsModule {}
