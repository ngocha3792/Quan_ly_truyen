import { createParamDecorator, ExecutionContext } from '@nestjs/common';

type UserRecord = Readonly<Record<string, unknown>>;

interface RequestWithUser {
  user?: UserRecord;
}

/**
 * Returns request.user, or one of its top-level properties.
 *
 * @example
 * current(@CurrentUser() user: AuthPrincipal)
 * currentId(@CurrentUser('userId') userId: string)
 */
export const CurrentUser = createParamDecorator(
  (property: string | undefined, context: ExecutionContext): unknown => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const user = request.user;

    if (!property) {
      return user;
    }

    return user?.[property];
  },
);
