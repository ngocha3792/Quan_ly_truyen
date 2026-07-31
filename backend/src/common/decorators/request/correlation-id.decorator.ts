import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { HTTP_HEADERS } from '@/common/constants';

interface RequestWithMetadata {
  correlationId?: unknown;
  requestContext?: {
    correlationId?: unknown;
  };
  headers?: Readonly<Record<string, string | string[] | undefined>>;
}

function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Returns the resolved correlation ID. */
export const CorrelationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithMetadata>();

    const value =
      request.requestContext?.correlationId ??
      request.correlationId ??
      firstHeaderValue(request.headers?.[HTTP_HEADERS.CORRELATION_ID]);

    return typeof value === 'string' ? value : undefined;
  },
);
