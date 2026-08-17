import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import { TagsService, TAG_REPOSITORY } from './application';
import { PrismaTagRepository } from './infrastructure';
import { AdminTagsController } from './presentation/http/controllers';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [AdminTagsController],
  providers: [
    TagsService,
    PrismaTagRepository,
    { provide: TAG_REPOSITORY, useExisting: PrismaTagRepository },
  ],
  exports: [TagsService],
})
export class TagsModule {}
