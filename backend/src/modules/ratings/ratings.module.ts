import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  DeleteRatingCommandHandler,
  GetMyRatingQueryHandler,
  RATING_PERSISTENCE_PORT,
  UpsertRatingCommandHandler,
} from './application';
import { PrismaRatingPersistence } from './infrastructure';
import { RatingsController } from './presentation';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [RatingsController],
  providers: [
    GetMyRatingQueryHandler,
    UpsertRatingCommandHandler,
    DeleteRatingCommandHandler,
    PrismaRatingPersistence,
    {
      provide: RATING_PERSISTENCE_PORT,
      useExisting: PrismaRatingPersistence,
    },
  ],
})
export class RatingsModule {}
