import { Inject, Injectable, Logger } from '@nestjs/common';

import { RoleCode } from '@/common/enums';

import { AuthenticationRequiredException } from '@/common/exceptions';

import {
  AUTHORIZATION_INVALIDATION_PORT,
  type AuthorizationInvalidationPort,
} from '@/common/interfaces/auth';

import { isUuidV4 } from '@/common/utils';

import {
  LastActiveAdminException,
  ManagedUserDeletedException,
  ManagedUserNotFoundException,
  ManagedUserRoleProtectedException,
  ManagedUserRoleUnavailableException,
  ManagedUserSelfAdminRoleRemovalException,
} from '../../../domain';

import type { ManagedUserDetailResultDto } from '../../dto';

import { ManagedUserResultMapper } from '../../mappers';

import {
  MANAGED_USER_PERSISTENCE_PORT,
  type ManagedUserPersistencePort,
} from '../../ports';

import { RemoveManagedUserRoleCommand } from './remove-managed-user-role.command';

@Injectable()
export class RemoveManagedUserRoleCommandHandler {
  private readonly logger = new Logger(
    RemoveManagedUserRoleCommandHandler.name,
  );

  constructor(
    @Inject(MANAGED_USER_PERSISTENCE_PORT)
    private readonly persistence: ManagedUserPersistencePort,

    @Inject(AUTHORIZATION_INVALIDATION_PORT)
    private readonly authorizationInvalidation: AuthorizationInvalidationPort,
  ) {}

  async execute(
    command: RemoveManagedUserRoleCommand,
  ): Promise<ManagedUserDetailResultDto> {
    const actorUserId = this.requireActor(command.actorUserId);

    if (command.roleCode !== RoleCode.ADMIN) {
      throw new ManagedUserRoleProtectedException(command.roleCode);
    }

    if (
      actorUserId === command.targetUserId &&
      command.roleCode === RoleCode.ADMIN
    ) {
      throw new ManagedUserSelfAdminRoleRemovalException();
    }

    const result = await this.persistence.removeManagedUserRole({
      actorUserId,

      targetUserId: command.targetUserId,

      roleCode: command.roleCode,

      changedAt: new Date(),

      audit: {
        ipAddress: command.ipAddress,

        userAgent: command.userAgent,

        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'updated':
        /*
         * Đây là privilege REVOKE.
         *
         * Persistence đồng thời revoke
         * session trước khi commit.
         */
        try {
          await this.authorizationInvalidation.invalidateUser(
            command.targetUserId,
          );
        } catch (error: unknown) {
          this.logger.warn(
            `Authorization cache invalidation failed after managed role removal for ${command.targetUserId}`,

            error instanceof Error ? error.stack : undefined,
          );
        }

        return ManagedUserResultMapper.toDetailDto(result.user);

      case 'unchanged':
        return ManagedUserResultMapper.toDetailDto(result.user);

      case 'not_found':
        throw new ManagedUserNotFoundException(command.targetUserId);

      case 'deleted':
        throw new ManagedUserDeletedException();

      case 'role_missing':
        throw new ManagedUserRoleUnavailableException(command.roleCode);

      case 'role_protected':
        throw new ManagedUserRoleProtectedException(command.roleCode);

      case 'last_active_admin':
        throw new LastActiveAdminException();

      default:
        throw new ManagedUserNotFoundException(command.targetUserId);
    }
  }

  private requireActor(userId: string | undefined): string {
    if (!userId || !isUuidV4(userId)) {
      throw new AuthenticationRequiredException({
        code: 'MANAGED_USER_ACTOR_REQUIRED',

        message: 'Không xác định được quản trị viên hiện tại',
      });
    }

    return userId;
  }
}
