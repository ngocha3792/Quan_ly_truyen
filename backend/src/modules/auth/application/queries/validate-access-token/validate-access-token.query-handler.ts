import { Inject, Injectable, Optional } from '@nestjs/common';

import { JwtTokenType, RoleCode } from '@/common/enums';
import { InvalidTokenException } from '@/common/exceptions';
import type { AuthPrincipal } from '@/common/interfaces/auth';
import { isUuidV4 } from '@/common/utils';

import {
  ACCESS_SESSION_READER_PORT,
  type AccessSessionReaderPort,
  ADMIN_MFA_CHALLENGE_PORT,
  type AdminMfaChallengePort,
  JWT_BLACKLIST_PORT,
  type JwtBlacklistPort,
} from '../../ports';
import { AuthAccountStatus } from '../../../domain/enums';

import { ValidateAccessTokenQuery } from './validate-access-token.query';

@Injectable()
export class ValidateAccessTokenQueryHandler {
  constructor(
    @Inject(ACCESS_SESSION_READER_PORT)
    private readonly sessionReader: AccessSessionReaderPort,

    @Inject(JWT_BLACKLIST_PORT)
    private readonly jwtBlacklist: JwtBlacklistPort,

    @Optional()
    @Inject(ADMIN_MFA_CHALLENGE_PORT)
    private readonly adminMfaChallenge?: AdminMfaChallengePort,
  ) {}

  async execute(query: ValidateAccessTokenQuery): Promise<AuthPrincipal> {
    const payload = query.payload;

    if (
      !payload ||
      payload.typ !== JwtTokenType.ACCESS ||
      !isUuidV4(payload.sub) ||
      !isUuidV4(payload.sid) ||
      !isUuidV4(payload.jti) ||
      !Number.isSafeInteger(payload.ver) ||
      payload.ver < 0 ||
      !Number.isSafeInteger(payload.exp)
    ) {
      throw new InvalidTokenException({
        message: 'Access token payload không hợp lệ',
      });
    }

    const isBlacklisted = await this.jwtBlacklist.isBlacklisted(payload.jti);

    if (isBlacklisted) {
      throw new InvalidTokenException({
        code: 'AUTH_ACCESS_TOKEN_BLACKLISTED',
        message: 'Access token không còn hiệu lực',
      });
    }

    const session = await this.sessionReader.findBySessionId(payload.sid);

    const now = new Date();

    if (
      !session ||
      session.userId !== payload.sub ||
      session.accessTokenVersion !== payload.ver ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      session.userDeletedAt !== null ||
      session.accountStatus !== AuthAccountStatus.ACTIVE
    ) {
      throw new InvalidTokenException({
        message: 'Access token không còn hiệu lực',
      });
    }

    if (
      this.adminMfaChallenge?.isEnabled() &&
      session.roles.includes(RoleCode.ADMIN) &&
      !session.mfaVerifiedAt
    ) {
      throw new InvalidTokenException({
        code: 'AUTH_ADMIN_MFA_REQUIRED',
        message: 'Session quản trị viên chưa được xác minh MFA',
      });
    }

    return {
      userId: session.userId,
      sessionId: session.sessionId,

      email: session.email,

      emailVerified: session.emailVerifiedAt !== null,

      roles: [...session.roles],
      permissions: [...session.permissions],

      authorProfileId: session.authorProfileId,
      mfaVerified: Boolean(session.mfaVerifiedAt),

      tokenId: payload.jti,

      tokenExpiresAt: new Date(payload.exp! * 1000),
    };
  }
}
