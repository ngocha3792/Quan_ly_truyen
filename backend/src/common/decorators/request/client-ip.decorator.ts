import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

import { HTTP_HEADERS } from '@/common/constants';

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

function normalizeForwardedFor(
  value: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(',')[0]?.trim() || undefined;
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

    const values: unknown[] = [
      request.requestContext?.ipAddress,
      request.ip,
      normalizeForwardedFor(
        request.headers?.[HTTP_HEADERS.X_FORWARDED_FOR],
      ),
      request.socket?.remoteAddress,
    ];

    return values.find(
      (value): value is string =>
        typeof value === 'string' && value.length > 0,
    );
  },
);
