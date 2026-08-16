import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  AUTHOR_PERSISTENCE_PORT,
  GetAuthorDashboardQueryHandler,
  GetAuthorDetailQueryHandler,
  GetAuthorDirectoryQueryHandler,
} from './application';
import { PrismaAuthorPersistence } from './infrastructure';
import {
  AuthorDashboardController,
  PublicAuthorsController,
} from './presentation/http';

const portProviders = [
  {
    provide: AUTHOR_PERSISTENCE_PORT,
    useExisting: PrismaAuthorPersistence,
  },
];

const queryHandlers = [
  GetAuthorDirectoryQueryHandler,
  GetAuthorDetailQueryHandler,
  GetAuthorDashboardQueryHandler,
];

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [PublicAuthorsController, AuthorDashboardController],
  providers: [PrismaAuthorPersistence, ...portProviders, ...queryHandlers],
})
export class AuthorsModule {}
