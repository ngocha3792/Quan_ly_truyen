import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';

import { isUuidV4 } from '@/common/utils';

import type { SecurityOverviewResultDto } from '../../dto';

import {
  SECURITY_OVERVIEW_READER_PORT,
  type SecurityOverviewReaderPort,
} from '../../ports';

import { GetSecurityOverviewQuery } from './get-security-overview.query';

@Injectable()
export class GetSecurityOverviewQueryHandler {
  constructor(
    @Inject(SECURITY_OVERVIEW_READER_PORT)
    private readonly reader: SecurityOverviewReaderPort,
  ) {}

  async execute(
    query: GetSecurityOverviewQuery,
  ): Promise<SecurityOverviewResultDto> {
    if (!isUuidV4(query.userId)) {
      throw this.authenticationRequired();
    }

    const overview = await this.reader.findByUserId(query.userId, new Date());

    if (!overview) {
      throw this.authenticationRequired();
    }

    return {
      passwordConfigured: overview.passwordConfigured,

      passwordUpdatedAt: overview.passwordUpdatedAt,

      mfaEnabled: overview.mfaEnabled,

      mfaConfiguredAt: overview.mfaConfiguredAt,

      recoveryEmail: overview.recoveryEmail,

      recoveryEmailVerified: overview.recoveryEmailVerified,

      securityQuestionsConfigured: overview.securityQuestionsConfigured,

      trustedDeviceCount: overview.trustedDeviceCount,
    };
  }

  private authenticationRequired(): AuthenticationRequiredException {
    return new AuthenticationRequiredException({
      code: 'AUTH_CURRENT_USER_UNAVAILABLE',

      message: 'Phiên đăng nhập không còn hiệu lực',
    });
  }
}
