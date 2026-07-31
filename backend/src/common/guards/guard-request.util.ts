import type { ExecutionContext } from '@nestjs/common';

import { AuthenticationRequiredException } from '../exceptions';
import type {
  GuardHttpRequest,
  GuardPrincipal,
} from './guard-principal.interface';

export function getGuardRequest(context: ExecutionContext): GuardHttpRequest {
  return context.switchToHttp().getRequest<GuardHttpRequest>();
}

export function getGuardPrincipal(
  context: ExecutionContext,
): GuardPrincipal | undefined {
  return getGuardRequest(context).user;
}

export function requireGuardPrincipal(
  context: ExecutionContext,
): GuardPrincipal {
  const principal = getGuardPrincipal(context);

  if (!principal) {
    throw new AuthenticationRequiredException();
  }

  return principal;
}

export function getPrincipalUserId(
  principal: GuardPrincipal,
): string | undefined {
  return principal.userId ?? principal.sub;
}

export function getAuthorizationHeader(
  request: GuardHttpRequest,
): string | undefined {
  const raw = request.headers?.authorization;

  if (Array.isArray(raw)) {
    return raw[0];
  }

  return typeof raw === 'string' ? raw : undefined;
}
