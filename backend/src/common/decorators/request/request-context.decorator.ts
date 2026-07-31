import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

interface RequestWithContext {
  requestContext?: unknown;
}

/** Returns the request context created by RequestContextInterceptor. */
export const RequestContext = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): unknown =>
    context
      .switchToHttp()
      .getRequest<RequestWithContext>()
      .requestContext,
);
