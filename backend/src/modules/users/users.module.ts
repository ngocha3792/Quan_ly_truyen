import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  MANAGED_USER_PERSISTENCE_PORT,
  MANAGED_USER_READER_PORT,
  USER_MODERATION_PORT,
  USER_PROFILE_PERSISTENCE_PORT,
  USER_PROFILE_READER_PORT,
  AssignManagedUserRoleCommandHandler,
  GetCurrentUserPreferencesQueryHandler,
  GetCurrentUserProfileQueryHandler,
  GetManagedUserQueryHandler,
  ListManagedUsersQueryHandler,
  RemoveManagedUserRoleCommandHandler,
  UpdateCurrentUserPreferencesCommandHandler,
  UpdateCurrentUserProfileCommandHandler,
  UpdateManagedUserStatusCommand,
  UpdateManagedUserStatusCommandHandler,
  type UserModerationPort,
} from './application';
import { ManagedUserStatus } from './domain';
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
    {
      provide: USER_MODERATION_PORT,
      inject: [UpdateManagedUserStatusCommandHandler],
      useFactory: (
        updateUserStatus: UpdateManagedUserStatusCommandHandler,
      ): UserModerationPort => ({
        banUser: async (input) => {
          await updateUserStatus.execute(
            new UpdateManagedUserStatusCommand(
              input.actorUserId,
              input.targetUserId,
              ManagedUserStatus.BANNED,
              input.ipAddress,
              input.userAgent,
              input.requestId,
              input.reason,
            ),
          );
        },
      }),
    },
  ],
  exports: [UpdateManagedUserStatusCommandHandler, USER_MODERATION_PORT],
})
export class UsersModule {}
