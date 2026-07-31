import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface RequestWithPrincipal {
  user?: {
    userId?: unknown;
    sub?: unknown;
  };
}

/** Returns the authenticated user ID from request.user.userId or request.user.sub. */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

    const value = request.user?.userId ?? request.user?.sub;

    return typeof value === 'string' ? value : undefined;
  },
);
