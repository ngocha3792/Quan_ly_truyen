import { Inject, Injectable } from '@nestjs/common';

import {
  REFRESH_SESSION_PERSISTENCE_PORT,
  type RefreshSessionPersistencePort,
  REFRESH_TOKEN_VERIFIER_PORT,
  type RefreshTokenVerifierPort,
} from '../../ports';
import { InvalidRefreshTokenException } from '../../../domain/exceptions';
import { SessionRevocationReason } from '../../../domain/enums';

import { LogoutCommand } from './logout.command';

@Injectable()
export class LogoutCommandHandler {
  constructor(
    @Inject(REFRESH_TOKEN_VERIFIER_PORT)
    private readonly refreshTokenVerifier: RefreshTokenVerifierPort,

    @Inject(REFRESH_SESSION_PERSISTENCE_PORT)
    private readonly sessionPersistence: RefreshSessionPersistencePort,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    /*
     * Logout là idempotent.
     * Không có cookie nghĩa là phía client đã logout.
     */
    if (!command.refreshToken) {
      return;
    }

    try {
      const verifiedToken = this.refreshTokenVerifier.verify(
        command.refreshToken,
      );

      await this.sessionPersistence.revokeCurrentSession({
        sessionId: verifiedToken.sessionId,
        userId: verifiedToken.userId,
        familyId: verifiedToken.familyId,

        revokedAt: new Date(),
        reason: SessionRevocationReason.USER_LOGOUT,
      });
    } catch (error: unknown) {
      /*
       * Refresh token sai chữ ký, hết hạn hoặc không hợp lệ:
       * vẫn xem logout là thành công và để controller xóa cookie.
       *
       * Không trả lỗi khác nhau để tránh làm lộ trạng thái token.
       */
      if (error instanceof InvalidRefreshTokenException) {
        return;
      }

      /*
       * Lỗi database/infrastructure phải được ném lại.
       * Controller sẽ không xóa cookie để client có thể retry logout.
       */
      throw error;
    }
  }
}
