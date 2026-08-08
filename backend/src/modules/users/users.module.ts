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
} from './application';

import {
  PrismaManagedUserRepository,
  PrismaUserProfileRepository,
} from './infrastructure';

import { AdminUsersController, UsersController } from './presentation/http';

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
  ],
})
export class UsersModule {}
