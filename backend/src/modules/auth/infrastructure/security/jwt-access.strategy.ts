import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AUTH_STRATEGIES } from '@/common/constants';
import type {
  AccessTokenPayload,
  AuthPrincipal,
} from '@/common/interfaces/auth';
import type { AuthConfig } from '@/config';

import {
  ValidateAccessTokenQuery,
  ValidateAccessTokenQueryHandler,
} from '../../application';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  AUTH_STRATEGIES.JWT_ACCESS,
) {
  constructor(
    configService: ConfigService,
    private readonly validationHandler: ValidateAccessTokenQueryHandler,
  ) {
    const config = configService.getOrThrow<AuthConfig>('auth');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.accessTokenSecret,
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }

  validate(payload: AccessTokenPayload): Promise<AuthPrincipal> {
    return this.validationHandler.execute(
      new ValidateAccessTokenQuery(payload),
    );
  }
}
