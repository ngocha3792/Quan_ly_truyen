import { Inject, Injectable } from '@nestjs/common';

import {
  AuthenticationRequiredException,
  InvalidInputException,
} from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import {
  SESSION_MANAGEMENT_PERSISTENCE_PORT,
  type SessionManagementPersistencePort,
} from '../../ports';

import { SessionRevocationReason } from '../../../domain/enums';

import { RevokeSessionCommand } from './revoke-session.command';

@Injectable()
export class RevokeSessionCommandHandler {
  constructor(
    @Inject(SESSION_MANAGEMENT_PERSISTENCE_PORT)
    private readonly sessionPersistence: SessionManagementPersistencePort,
  ) {}

  async execute(command: RevokeSessionCommand): Promise<void> {
    if (!isUuidV4(command.userId) || !isUuidV4(command.actorSessionId)) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_SESSION_PRINCIPAL_REQUIRED',

        message: 'Không tìm thấy phiên đăng nhập hiện tại',
      });
    }

    if (!isUuidV4(command.sessionId)) {
      throw new InvalidInputException({
        code: 'AUTH_SESSION_ID_INVALID',

        message: 'Mã phiên đăng nhập không hợp lệ',

        details: {
          field: 'sessionId',
        },
      });
    }

    await this.sessionPersistence.revokeUserSession({
      userId: command.userId,

      actorSessionId: command.actorSessionId,

      sessionId: command.sessionId,

      revokedAt: new Date(),

      reason: SessionRevocationReason.USER_REVOKED_SESSION,
    });
  }
}
