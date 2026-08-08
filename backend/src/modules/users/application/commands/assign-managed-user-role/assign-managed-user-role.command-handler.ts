import { Inject, Injectable, Logger } from '@nestjs/common';

import { RoleCode } from '@/common/enums';

import { AuthenticationRequiredException } from '@/common/exceptions';

import {
  AUTHORIZATION_INVALIDATION_PORT,
  type AuthorizationInvalidationPort,
} from '@/common/interfaces/auth';

import { isUuidV4 } from '@/common/utils';

import {
  ManagedUserDeletedException,
  ManagedUserNotFoundException,
  ManagedUserRoleProtectedException,
  ManagedUserRoleUnavailableException,
} from '../../../domain';

import type { ManagedUserDetailResultDto } from '../../dto';

import { ManagedUserResultMapper } from '../../mappers';

import {
  MANAGED_USER_PERSISTENCE_PORT,
  type ManagedUserPersistencePort,
} from '../../ports';

import { AssignManagedUserRoleCommand } from './assign-managed-user-role.command';

@Injectable()
export class AssignManagedUserRoleCommandHandler {
  private readonly logger = new Logger(
    AssignManagedUserRoleCommandHandler.name,
  );

  constructor(
    @Inject(MANAGED_USER_PERSISTENCE_PORT)
    private readonly persistence: ManagedUserPersistencePort,

    @Inject(AUTHORIZATION_INVALIDATION_PORT)
    private readonly authorizationInvalidation: AuthorizationInvalidationPort,
  ) {}

  async execute(
    command: AssignManagedUserRoleCommand,
  ): Promise<ManagedUserDetailResultDto> {
    const actorUserId = this.requireActor(command.actorUserId);

    /*
     * USER là role nền.
     *
     * AUTHOR phải do
     * Author Application approve.
     *
     * User Management chỉ trực tiếp
     * quản lý privilege ADMIN.
     */
    if (command.roleCode !== RoleCode.ADMIN) {
      throw new ManagedUserRoleProtectedException(command.roleCode);
    }

    const result = await this.persistence.assignManagedUserRole({
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
         * Role GRANT.
         *
         * Invalidation fail chủ yếu
         * gây false-deny cho tới khi
         * cache hết TTL.
         */
        try {
          await this.authorizationInvalidation.invalidateUser(
            command.targetUserId,
          );
        } catch (error: unknown) {
          this.logger.warn(
            `Authorization cache invalidation failed after managed role assignment for ${command.targetUserId}`,

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
