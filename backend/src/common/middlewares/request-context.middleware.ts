import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { context as otelContext, trace } from '@opentelemetry/api';

import { COMMON_MIDDLEWARE_OPTIONS } from './common-middlewares.constants';
import type { CommonMiddlewaresOptions } from './common-middlewares-options.interface';
import { createRequestContext } from './middleware-request.util';
import type {
  MiddlewareHttpRequest,
  MiddlewareHttpResponse,
  MiddlewareNext,
} from './request-context.interface';
import { RequestContextStore } from './request-context.store';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    private readonly store: RequestContextStore,
    @Inject(COMMON_MIDDLEWARE_OPTIONS)
    private readonly options: CommonMiddlewaresOptions,
  ) {}

  use(
    request: MiddlewareHttpRequest,
    response: MiddlewareHttpResponse,
    next: MiddlewareNext,
  ): void {
    const context = createRequestContext(request, this.options.requestContext);

    request.requestId = context.requestId;
    request.correlationId = context.correlationId;
    request.requestContext = context;

    response.setHeader('x-request-id', context.requestId);
    response.setHeader('x-correlation-id', context.correlationId);
    const traceId = trace.getSpan(otelContext.active())?.spanContext().traceId;
    if (traceId) response.setHeader('x-trace-id', traceId);

    this.store.run(context, () => next());
  }
}
