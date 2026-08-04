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
     * KhÃ´ng Ä‘Æ°á»£c truyá»n undefined vÃ o Prisma updateMany.
     * Trong Prisma, má»™t giÃ¡ trá»‹ undefined cÃ³ thá»ƒ bá»‹ bá» khá»i
     * Ä‘iá»u kiá»‡n where vÃ  gÃ¢y cáº­p nháº­t sai pháº¡m vi.
     */
    if (!isUuidV4(command.userId) || !isUuidV4(command.currentSessionId)) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_PRINCIPAL_REQUIRED',

        message: 'KhÃ´ng tÃ¬m tháº¥y thÃ´ng tin ngÆ°á»i dÃ¹ng Ä‘Ã£ xÃ¡c thá»±c',
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
