import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import { FOLLOW_REPOSITORY, FollowsService } from './application';
import { PrismaFollowRepository } from './infrastructure';
import { AuthorFollowController } from './presentation/http/controllers';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [AuthorFollowController],
  providers: [
    FollowsService,
    PrismaFollowRepository,
    { provide: FOLLOW_REPOSITORY, useExisting: PrismaFollowRepository },
  ],
  exports: [FollowsService],
})
export class FollowsModule {}
