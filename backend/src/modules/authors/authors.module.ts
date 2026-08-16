import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  AUTHOR_PERSISTENCE_PORT,
  AuthorLifecycleService,
  GetAuthorDashboardQueryHandler,
  GetAuthorDetailQueryHandler,
  GetAuthorDirectoryQueryHandler,
} from './application';
import { PrismaAuthorPersistence } from './infrastructure';
import {
  ActiveAuthorGuard,
  AdminAuthorsController,
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
  controllers: [
    PublicAuthorsController,
    AuthorDashboardController,
    AdminAuthorsController,
  ],
  providers: [
    PrismaAuthorPersistence,
    AuthorLifecycleService,
    ActiveAuthorGuard,
    ...portProviders,
    ...queryHandlers,
  ],
  exports: [AuthorLifecycleService, ActiveAuthorGuard],
})
export class AuthorsModule {}
