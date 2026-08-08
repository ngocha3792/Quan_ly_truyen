import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import {
  SESSION_MANAGEMENT_PERSISTENCE_PORT,
  type SessionManagementPersistencePort,
} from '../../ports';

import { SessionRevocationReason } from '../../../domain/enums';

import { RevokeOtherSessionsCommand } from './revoke-other-sessions.command';

@Injectable()
export class RevokeOtherSessionsCommandHandler {
  constructor(
    @Inject(SESSION_MANAGEMENT_PERSISTENCE_PORT)
    private readonly sessionPersistence: SessionManagementPersistencePort,
  ) {}

  async execute(
    command: RevokeOtherSessionsCommand,
  ): Promise<number> {
    if (
      !isUuidV4(command.userId) ||
      !isUuidV4(command.actorSessionId)
    ) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_SESSION_PRINCIPAL_REQUIRED',

        message: 'Không tìm thấy phiên đăng nhập hiện tại',
      });
    }

    return this.sessionPersistence.revokeOtherUserSessions({
      userId: command.userId,

      actorSessionId: command.actorSessionId,

      revokedAt: new Date(),

      reason: SessionRevocationReason.USER_REVOKED_SESSION,
    });
  }
}
