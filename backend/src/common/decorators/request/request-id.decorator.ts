import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

import { HTTP_HEADERS } from '@/common/constants';

interface RequestWithMetadata {
  requestId?: unknown;
  requestContext?: {
    requestId?: unknown;
  };
  headers?: Readonly<Record<string, string | string[] | undefined>>;
}

function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Returns the resolved request ID. */
export const RequestId = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): string | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithMetadata>();

    const value =
      request.requestContext?.requestId ??
      request.requestId ??
      firstHeaderValue(
        request.headers?.[HTTP_HEADERS.REQUEST_ID],
      );

    return typeof value === 'string' ? value : undefined;
  },
);
