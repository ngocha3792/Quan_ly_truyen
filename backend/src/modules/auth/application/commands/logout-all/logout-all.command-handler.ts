import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  REFRESH_SESSION_PERSISTENCE_PORT,
  type RefreshSessionPersistencePort,
} from '../../ports';
import { SessionRevocationReason } from '../../../domain/enums';

import { LogoutAllCommand } from './logout-all.command';

@Injectable()
export class LogoutAllCommandHandler {
  constructor(
    @Inject(REFRESH_SESSION_PERSISTENCE_PORT)
    private readonly sessionPersistence: RefreshSessionPersistencePort,
  ) {}

  async execute(command: LogoutAllCommand): Promise<void> {
    /*
     * Không được truyền undefined vào Prisma updateMany.
     * Trong Prisma, một giá trị undefined có thể bị bỏ khỏi
     * điều kiện where và gây cập nhật sai phạm vi.
     */
    if (!isUuidV4(command.userId) || !isUuidV4(command.currentSessionId)) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_PRINCIPAL_REQUIRED',

        message: 'Không tìm thấy thông tin người dùng đã xác thực',
      });
    }

    await this.sessionPersistence.revokeAllUserSessions({
      userId: command.userId,

      actorSessionId: command.currentSessionId,

      revokedAt: new Date(),

      reason: SessionRevocationReason.USER_LOGOUT_ALL,
    });
  }
}
