import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface RequestWithPrincipal {
  user?: {
    sessionId?: unknown;
    sid?: unknown;
  };
}

/** Returns the authenticated session ID from request.user.sessionId or sid. */
export const CurrentSessionId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

    const value = request.user?.sessionId ?? request.user?.sid;

    return typeof value === 'string' ? value : undefined;
  },
);
