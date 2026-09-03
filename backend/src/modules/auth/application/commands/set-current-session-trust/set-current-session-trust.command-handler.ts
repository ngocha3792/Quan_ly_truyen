import { Inject, Injectable } from '@nestjs/common';
import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';
import {
  SESSION_MANAGEMENT_PERSISTENCE_PORT,
  type SessionManagementPersistencePort,
} from '../../ports';
import { SetCurrentSessionTrustCommand } from './set-current-session-trust.command';

@Injectable()
export class SetCurrentSessionTrustCommandHandler {
  constructor(
    @Inject(SESSION_MANAGEMENT_PERSISTENCE_PORT)
    private readonly persistence: SessionManagementPersistencePort,
  ) {}

  async execute(command: SetCurrentSessionTrustCommand): Promise<void> {
    if (!isUuidV4(command.userId) || !isUuidV4(command.sessionId)) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_SESSION_PRINCIPAL_REQUIRED',
        message: 'Không tìm thấy phiên đăng nhập hiện tại',
      });
    }
    const updated = await this.persistence.setCurrentSessionTrusted({
      userId: command.userId,
      sessionId: command.sessionId,
      trusted: command.trusted,
      changedAt: new Date(),
    });
    if (!updated) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_SESSION_NOT_ACTIVE',
        message: 'Phiên đăng nhập hiện tại không còn hoạt động',
      });
    }
  }
}
