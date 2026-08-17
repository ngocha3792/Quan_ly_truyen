import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  TAG_REPOSITORY,
  CreateTagCommandHandler,
  DeleteTagCommandHandler,
  ListTagsQueryHandler,
  MergeTagsCommandHandler,
  UpdateTagCommandHandler,
} from './application';
import { PrismaTagRepository } from './infrastructure';
import { AdminTagsController } from './presentation/http/controllers';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [AdminTagsController],
  providers: [
    ListTagsQueryHandler,
    CreateTagCommandHandler,
    UpdateTagCommandHandler,
    DeleteTagCommandHandler,
    MergeTagsCommandHandler,
    PrismaTagRepository,
    { provide: TAG_REPOSITORY, useExisting: PrismaTagRepository },
  ],
})
export class TagsModule {}
