import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { HTTP_HEADERS } from '@/common/constants';

interface RequestWithHeaders {
  requestContext?: {
    userAgent?: unknown;
  };
  headers?: Readonly<Record<string, string | string[] | undefined>>;
}

/** Returns the request user-agent header. */
export const UserAgent = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithHeaders>();

    const header = request.headers?.[HTTP_HEADERS.USER_AGENT];

    const value =
      request.requestContext?.userAgent ??
      (Array.isArray(header) ? header[0] : header);

    return typeof value === 'string' ? value : undefined;
  },
);
