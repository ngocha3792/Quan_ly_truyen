import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, TimeoutError, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

import {
  COMMON_HTTP_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS_KEY,
  SKIP_REQUEST_TIMEOUT_KEY,
} from '@/common/constants';
import { RequestTimeoutException } from '../exceptions';

@Injectable()
export class TimeoutInterceptor<T> implements NestInterceptor<T, T> {
  constructor(
    private readonly reflector: Reflector,
    @Inject(COMMON_HTTP_TIMEOUT_MS)
    private readonly defaultTimeoutMs: number,
  ) {}

  intercept(
    executionContext: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T> {
    if (executionContext.getType() !== 'http') {
      return next.handle();
    }

    const shouldSkip = this.reflector.getAllAndOverride<boolean>(
      SKIP_REQUEST_TIMEOUT_KEY,
      [executionContext.getHandler(), executionContext.getClass()],
    );

    if (shouldSkip) {
      return next.handle();
    }

    const routeTimeoutMs = this.reflector.getAllAndOverride<number>(
      REQUEST_TIMEOUT_MS_KEY,
      [executionContext.getHandler(), executionContext.getClass()],
    );

    const timeoutMs = routeTimeoutMs ?? this.defaultTimeoutMs;

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return next.handle();
    }

    const operation = [
      executionContext.getClass().name,
      executionContext.getHandler().name,
    ].join('.');

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((error: unknown) => {
        if (error instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException({
                timeoutMs,
                operation,
                cause: error,
              }),
          );
        }

        return throwError(() => error);
      }),
    );
  }
}
