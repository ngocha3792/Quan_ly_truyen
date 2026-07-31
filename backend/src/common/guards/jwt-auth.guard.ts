import type { ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { AUTH_STRATEGIES, IS_PUBLIC_KEY } from '../constants';
import { AuthenticationRequiredException } from '../exceptions';
import type { GuardPrincipal } from './guard-principal.interface';
import { throwPassportAuthenticationFailure } from './passport-auth-failure.util';

/**
 * Global access-token guard. Routes marked with @Public() bypass authentication.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard(AUTH_STRATEGIES.JWT_ACCESS) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = GuardPrincipal>(
    error: unknown,
    user: TUser | false | null,
    info: unknown,
    _context: ExecutionContext,
    _status?: unknown,
  ): TUser {
    if (error || info) {
      throwPassportAuthenticationFailure(error, info);
    }

    if (!user) {
      throw new AuthenticationRequiredException();
    }

    return user;
  }
}
