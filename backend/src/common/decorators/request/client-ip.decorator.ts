import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

import { HTTP_HEADERS } from '@/common/constants';
import { resolveClientIp } from '@/common/utils';

interface RequestWithIp {
  ip?: unknown;
  requestContext?: {
    ipAddress?: unknown;
  };
  headers?: Readonly<Record<string, string | string[] | undefined>>;
  socket?: {
    remoteAddress?: unknown;
  };
}

/**
 * Returns the best available client IP. Correct proxy trust configuration is
 * still required; never trust x-forwarded-for from arbitrary clients.
 */
export const ClientIp = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): string | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithIp>();

    if (
      typeof request.requestContext?.ipAddress === 'string' &&
      request.requestContext.ipAddress.length > 0
    ) {
      return request.requestContext.ipAddress;
    }

    const resolved = resolveClientIp({
      forwardedFor: request.headers?.[HTTP_HEADERS.X_FORWARDED_FOR],
      realIp: request.headers?.[HTTP_HEADERS.X_REAL_IP],
      socketIp: typeof request.ip === 'string' ? request.ip : typeof request.socket?.remoteAddress === 'string' ? request.socket.remoteAddress : undefined,
    });

    return resolved ?? undefined;
  },
);
