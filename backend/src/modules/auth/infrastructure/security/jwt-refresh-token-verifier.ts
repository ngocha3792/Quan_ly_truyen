import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtTokenType } from '@/common/enums';
import type { RefreshTokenPayload } from '@/common/interfaces/auth';
import { isUuidV4, verifyJwt } from '@/common/utils';
import type { AuthConfig } from '@/config';

import type {
  RefreshTokenVerifierPort,
  VerifiedRefreshToken,
} from '../../application/ports';
import { InvalidRefreshTokenException } from '../../domain/exceptions';

@Injectable()
export class JwtRefreshTokenVerifier implements RefreshTokenVerifierPort {
  private readonly config: AuthConfig;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<AuthConfig>('auth');
  }

  verify(token: string): VerifiedRefreshToken {
    try {
      const payload = verifyJwt<RefreshTokenPayload>(token, {
        key: this.config.refreshTokenSecret,
        algorithms: ['HS256'],
        issuer: this.config.issuer,
        audience: this.config.audience,
      });

      if (
        payload.typ !== JwtTokenType.REFRESH ||
        !isUuidV4(payload.sub) ||
        !isUuidV4(payload.sid) ||
        !isUuidV4(payload.familyId) ||
        !Number.isSafeInteger(payload.ver) ||
        payload.ver < 0
      ) {
        throw new InvalidRefreshTokenException();
      }

      return {
        userId: payload.sub,
        sessionId: payload.sid,
        familyId: payload.familyId,
        version: payload.ver,
      };
    } catch (error: unknown) {
      if (error instanceof InvalidRefreshTokenException) {
        throw error;
      }

      /*
       * Không để client phân biệt token sai chữ ký,
       * sai issuer hay đã hết hạn.
       */
      throw new InvalidRefreshTokenException(error);
    }
  }
}
