import { Inject, Injectable, Logger } from '@nestjs/common';

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
  ManagedUserSelfStatusChangeException,
  ManagedUserStatus,
  ManagedUserStatusNotManageableException,
  ManagedUserStatusReasonRequiredException,
} from '../../../domain';

import type { ManagedUserDetailResultDto } from '../../dto';

import { ManagedUserResultMapper } from '../../mappers';

import {
  MANAGED_USER_PERSISTENCE_PORT,
  type ManagedUserPersistencePort,
} from '../../ports';

import { UpdateManagedUserStatusCommand } from './update-managed-user-status.command';

@Injectable()
export class UpdateManagedUserStatusCommandHandler {
  private readonly logger = new Logger(
    UpdateManagedUserStatusCommandHandler.name,
  );

  constructor(
    @Inject(MANAGED_USER_PERSISTENCE_PORT)
    private readonly persistence: ManagedUserPersistencePort,

    @Inject(AUTHORIZATION_INVALIDATION_PORT)
    private readonly authorizationInvalidation: AuthorizationInvalidationPort,
  ) {}

  async execute(
    command: UpdateManagedUserStatusCommand,
  ): Promise<ManagedUserDetailResultDto> {
    const actorUserId = this.requireActor(command.actorUserId);

    if (actorUserId === command.targetUserId) {
      throw new ManagedUserSelfStatusChangeException();
    }

    /*
     * Soft-delete vẫn phải đi qua
     * account deletion use-case riêng.
     */
    if (command.status === ManagedUserStatus.DELETED) {
      throw new ManagedUserStatusNotManageableException();
    }

    const reason = command.reason?.trim();
    if (command.status !== ManagedUserStatus.ACTIVE && (!reason || reason.length < 10)) {
      throw new ManagedUserStatusReasonRequiredException();
    }

    const result = await this.persistence.updateManagedUserStatus({
      actorUserId,

      targetUserId: command.targetUserId,

      status: command.status,

      reason,

      changedAt: new Date(),

      audit: {
        ipAddress: command.ipAddress,

        userAgent: command.userAgent,

        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'updated':
        await this.invalidateAuthorization(command.targetUserId);

        return ManagedUserResultMapper.toDetailDto(result.user);

      case 'unchanged':
        return ManagedUserResultMapper.toDetailDto(result.user);

      case 'not_found':
        throw new ManagedUserNotFoundException(command.targetUserId);

      case 'deleted':
        throw new ManagedUserDeletedException();

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

  private async invalidateAuthorization(userId: string): Promise<void> {
    try {
      await this.authorizationInvalidation.invalidateUser(userId);
    } catch (error: unknown) {
      /*
       * Với suspend/ban:
       * session đã bị revoke trong
       * transaction DB.
       *
       * Cache invalidation fail không
       * được biến DB commit thành
       * false failure.
       */
      this.logger.warn(
        `Authorization cache invalidation failed after managed user status change for ${userId}`,

        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
