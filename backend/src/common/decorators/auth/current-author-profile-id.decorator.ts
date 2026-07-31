import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

interface RequestWithPrincipal {
  user?: {
    authorProfileId?: unknown;
  };
}

/** Returns the current user's author profile ID, when the user is an author. */
export const CurrentAuthorProfileId = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): string | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithPrincipal>();

    const value = request.user?.authorProfileId;

    return typeof value === 'string' ? value : undefined;
  },
);
