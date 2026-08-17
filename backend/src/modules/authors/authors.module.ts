import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  AUTHOR_PERSISTENCE_PORT,
  AUTHOR_LIFECYCLE_PERSISTENCE_PORT,
  AUTHOR_PROFILE_PERSISTENCE_PORT,
  AssertActiveAuthorQueryHandler,
  ChangeAuthorStatusCommandHandler,
  GetAdminAuthorDetailQueryHandler,
  GetAuthorProfileQueryHandler,
  ListAdminAuthorsQueryHandler,
  UpdateAuthorProfileCommandHandler,
  GetAuthorDashboardQueryHandler,
  GetAuthorDetailQueryHandler,
  GetAuthorDirectoryQueryHandler,
} from './application';
import { PrismaAuthorLifecyclePersistence, PrismaAuthorPersistence, PrismaAuthorProfilePersistence } from './infrastructure';
import {
  ActiveAuthorGuard,
  AdminAuthorsController,
  AuthorDashboardController,
  AuthorProfileController,
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
    AuthorProfileController,
    AuthorDashboardController,
    AdminAuthorsController,
  ],
  providers: [
    PrismaAuthorPersistence,
    PrismaAuthorLifecyclePersistence,
    PrismaAuthorProfilePersistence,
    AssertActiveAuthorQueryHandler,
    ListAdminAuthorsQueryHandler,
    GetAdminAuthorDetailQueryHandler,
    ChangeAuthorStatusCommandHandler,
    GetAuthorProfileQueryHandler,
    UpdateAuthorProfileCommandHandler,
    ActiveAuthorGuard,
    ...portProviders,
    { provide: AUTHOR_LIFECYCLE_PERSISTENCE_PORT, useExisting: PrismaAuthorLifecyclePersistence },
    { provide: AUTHOR_PROFILE_PERSISTENCE_PORT, useExisting: PrismaAuthorProfilePersistence },
    ...queryHandlers,
  ],
  exports: [AssertActiveAuthorQueryHandler, ActiveAuthorGuard],
})
export class AuthorsModule {}
