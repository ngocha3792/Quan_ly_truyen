import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';

import { SKIP_REQUEST_LOGGING_KEY } from '@/common/constants';
import type { HttpRequestWithContext } from './request-context.interface';

interface HttpResponseLike {
  statusCode?: unknown;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  intercept(
    executionContext: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (executionContext.getType() !== 'http') {
      return next.handle();
    }

    const shouldSkip = this.reflector.getAllAndOverride<boolean>(
      SKIP_REQUEST_LOGGING_KEY,
      [
        executionContext.getHandler(),
        executionContext.getClass(),
      ],
    );

    if (shouldSkip) {
      return next.handle();
    }

    const httpContext = executionContext.switchToHttp();
    const request =
      httpContext.getRequest<HttpRequestWithContext>();
    const response =
      httpContext.getResponse<HttpResponseLike>();

    const ctx = request.requestContext;
    const method = ctx?.method ?? (typeof request.method === 'string' ? request.method : 'UNKNOWN');
    const path = ctx?.path ?? (typeof request.originalUrl === 'string' ? request.originalUrl : typeof request.url === 'string' ? request.url : '/');
    const requestId = ctx?.requestId ?? (typeof request.requestId === 'string' ? request.requestId : 'N/A');
    const userId = ctx?.userId;

    const startedAt = performance.now();
    let completedSuccessfully = false;

    return next.handle().pipe(
      tap({
        complete: () => {
          completedSuccessfully = true;
        },
      }),
      finalize(() => {
        if (!completedSuccessfully) {
          // AllExceptionsFilter owns error logging to avoid duplicates.
          return;
        }

        const durationMs = Math.max(
          0,
          performance.now() - startedAt,
        );
        const statusCode =
          typeof response.statusCode === 'number'
            ? response.statusCode
            : 200;
        const controller = executionContext.getClass().name;
        const handler = executionContext.getHandler().name;

        const message = [
          `${method} ${path}`,
          `status=${statusCode}`,
          `durationMs=${durationMs.toFixed(2)}`,
          `requestId=${requestId}`,
          `handler=${controller}.${handler}`,
          userId ? `userId=${userId}` : undefined,
        ]
          .filter(Boolean)
          .join(' ');

        this.logger.log(message);
      }),
    );
  }
}
