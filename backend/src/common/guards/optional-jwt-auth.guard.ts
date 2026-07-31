import type { ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AUTH_SCHEMES, AUTH_STRATEGIES } from '../constants';
import { InvalidTokenException } from '../exceptions';
import type { GuardPrincipal } from './guard-principal.interface';
import { getAuthorizationHeader, getGuardRequest } from './guard-request.util';
import { throwPassportAuthenticationFailure } from './passport-auth-failure.util';

/**
 * Guest-or-user guard.
 * - No Authorization header: continue as Guest.
 * - Bearer token present: it must be valid; malformed/expired tokens are rejected.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard(
  AUTH_STRATEGIES.JWT_ACCESS,
) {
  canActivate(context: ExecutionContext) {
    const request = getGuardRequest(context);
    const authorization = getAuthorizationHeader(request);

    if (!authorization) {
      return true;
    }

    const bearerPattern = new RegExp(`^${AUTH_SCHEMES.BEARER}\\s+\\S+$`, 'i');

    if (!bearerPattern.test(authorization.trim())) {
      throw new InvalidTokenException({
        message: 'Authorization header phải có dạng Bearer <token>',
      });
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = GuardPrincipal>(
    error: unknown,
    user: TUser | false | null,
    info: unknown,
    _context: ExecutionContext,
    _status?: unknown,
  ): TUser | null {
    if (error || info) {
      throwPassportAuthenticationFailure(error, info);
    }

    return user || null;
  }
}
