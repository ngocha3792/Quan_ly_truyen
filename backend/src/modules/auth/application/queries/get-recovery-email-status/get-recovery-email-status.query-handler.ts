import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import type { RecoveryEmailStatusResultDto } from '../../dto';

import { RecoveryEmailStatusMapper } from '../../mappers';

import {
  RECOVERY_EMAIL_PERSISTENCE_PORT,
  type RecoveryEmailPersistencePort,
} from '../../ports';

import { GetRecoveryEmailStatusQuery } from './get-recovery-email-status.query';

@Injectable()
export class GetRecoveryEmailStatusQueryHandler {
  constructor(
    @Inject(RECOVERY_EMAIL_PERSISTENCE_PORT)
    private readonly persistence: RecoveryEmailPersistencePort,
  ) {}

  async execute(
    query: GetRecoveryEmailStatusQuery,
  ): Promise<RecoveryEmailStatusResultDto> {
    if (!query.userId || !isUuidV4(query.userId)) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_RECOVERY_EMAIL_AUTH_REQUIRED',

        message: 'Bạn cần đăng nhập để quản lý email khôi phục',
      });
    }

    const record = await this.persistence.findStatusByUserId(query.userId);

    if (!record) {
      throw new AuthenticationRequiredException({
        code: 'AUTH_ACCOUNT_NOT_AVAILABLE',

        message: 'Tài khoản hiện tại không còn khả dụng',
      });
    }

    return RecoveryEmailStatusMapper.toDto(record);
  }
}
