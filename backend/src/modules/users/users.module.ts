import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';

import { AuthAuthorizationModule } from '@/modules/auth';

import {
  AssignManagedUserRoleCommandHandler,
  GetManagedUserQueryHandler,
  GetCurrentUserPreferencesQueryHandler,
  GetCurrentUserProfileQueryHandler,
  ListManagedUsersQueryHandler,
  MANAGED_USER_PERSISTENCE_PORT,
  MANAGED_USER_READER_PORT,
  RemoveManagedUserRoleCommandHandler,
  USER_PROFILE_PERSISTENCE_PORT,
  USER_PROFILE_READER_PORT,
  UpdateManagedUserStatusCommandHandler,
  UpdateCurrentUserPreferencesCommandHandler,
  UpdateCurrentUserProfileCommandHandler,
  UserModerationFacade,
} from './application';

import {
  PrismaManagedUserRepository,
  PrismaUserProfileRepository,
} from './infrastructure';

import { AdminUsersController, UsersController } from './presentation/http';
import { USER_MODERATION_PORT } from './public';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],

  controllers: [UsersController, AdminUsersController],

  providers: [
    GetCurrentUserProfileQueryHandler,

    GetCurrentUserPreferencesQueryHandler,

    UpdateCurrentUserProfileCommandHandler,

    UpdateCurrentUserPreferencesCommandHandler,

    ListManagedUsersQueryHandler,

    GetManagedUserQueryHandler,

    UpdateManagedUserStatusCommandHandler,

    AssignManagedUserRoleCommandHandler,

    RemoveManagedUserRoleCommandHandler,

    UserModerationFacade,

    PrismaUserProfileRepository,

    PrismaManagedUserRepository,

    {
      provide: USER_PROFILE_READER_PORT,

      useExisting: PrismaUserProfileRepository,
    },

    {
      provide: USER_PROFILE_PERSISTENCE_PORT,

      useExisting: PrismaUserProfileRepository,
    },

    {
      provide: MANAGED_USER_READER_PORT,

      useExisting: PrismaManagedUserRepository,
    },

    {
      provide: MANAGED_USER_PERSISTENCE_PORT,

      useExisting: PrismaManagedUserRepository,
    },

    {
      provide: USER_MODERATION_PORT,
      useExisting: UserModerationFacade,
    },
  ],
  exports: [UpdateManagedUserStatusCommandHandler, USER_MODERATION_PORT],
})
export class UsersModule {}
