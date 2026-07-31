import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SKIP_RESPONSE_ENVELOPE_KEY } from '@/common/constants';
import type { ApiSuccessResponse } from '@/common/interfaces/http';
import type { HttpRequestWithContext } from './request-context.interface';

export interface ApiErrorEnvelopeLike {
  success: false;
  error: unknown;
}

export type ApiEnvelope<T> = ApiSuccessResponse<T> | ApiErrorEnvelopeLike;

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<
  T,
  ApiEnvelope<T> | T
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    executionContext: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiEnvelope<T> | T> {
    if (executionContext.getType() !== 'http') {
      return next.handle();
    }

    const shouldSkip = this.reflector.getAllAndOverride<boolean>(
      SKIP_RESPONSE_ENVELOPE_KEY,
      [executionContext.getHandler(), executionContext.getClass()],
    );

    if (shouldSkip) {
      return next.handle();
    }

    const request = executionContext
      .switchToHttp()
      .getRequest<HttpRequestWithContext>();

    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile || this.isEnvelope(data)) {
          return data;
        }

        const ctx = request.requestContext;
        const requestId =
          ctx?.requestId ??
          (typeof request.requestId === 'string' ? request.requestId : 'N/A');

        const response: ApiSuccessResponse<T> = {
          success: true,
          data,
          requestId,
          timestamp: new Date().toISOString(),
        };

        return response;
      }),
    );
  }

  private isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Record<string, unknown>;

    return candidate.success === true || candidate.success === false;
  }
}
