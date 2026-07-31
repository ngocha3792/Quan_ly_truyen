import { createHash } from 'node:crypto';
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';

import { IDEMPOTENT_KEY, IDEMPOTENCY_STORE } from '@/common/constants';
import type { IdempotencyMetadata } from '@/common/decorators';
import {
  IdempotencyConflictException,
  InvalidInputException,
} from '@/common/exceptions';
import type { IdempotencyStore } from '@/infrastructure/idempotency';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotencyStore: IdempotencyStore,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const metadata = this.reflector.getAllAndOverride<IdempotencyMetadata>(
      IDEMPOTENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const rawKey =
      request.headers['x-idempotency-key'] ??
      request.headers['idempotency-key'];

    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (!key || !key.trim()) {
      if (metadata.required) {
        throw new InvalidInputException({
          message: 'Header "x-idempotency-key" là bắt buộc cho thao tác này',
        });
      }
      return next.handle();
    }

    const trimmedKey = key.trim();
    const ttlSeconds = metadata.ttlSeconds ?? 86_400;
    const requestHash = this.computeRequestHash(request);

    const acquireResult = await this.idempotencyStore.acquire(
      trimmedKey,
      requestHash,
      ttlSeconds,
    );

    if (!acquireResult.acquired) {
      const existing = acquireResult.existingRecord;

      if (!existing || existing.state === 'PROCESSING') {
        throw new IdempotencyConflictException({
          key: trimmedKey,
          message: 'Yêu cầu trùng lặp đang được xử lý',
        });
      }

      if (existing.requestHash && existing.requestHash !== requestHash) {
        throw new IdempotencyConflictException({
          key: trimmedKey,
          existingRequestHash: existing.requestHash,
          currentRequestHash: requestHash,
          message: 'Idempotency key đã được sử dụng cho một request khác',
        });
      }

      if (existing.statusCode) {
        response.status(existing.statusCode);
      }

      if (existing.headers) {
        for (const [headerName, headerVal] of Object.entries(
          existing.headers,
        )) {
          response.setHeader(headerName, headerVal);
        }
      }

      response.setHeader('x-idempotent-replayed', 'true');
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      mergeMap(async (body) => {
        const statusCode = response.statusCode || 200;
        await this.idempotencyStore.saveResult(
          trimmedKey,
          {
            statusCode,
            responseBody: body,
          },
          ttlSeconds,
        );
        return body;
      }),
      catchError((err: unknown) => {
        return this.idempotencyStore
          .markFailed(trimmedKey)
          .then(() => throwError(() => err));
      }),
    );
  }

  private computeRequestHash(request: Request): string {
    const payload = {
      path: request.path,
      method: request.method,
      body: request.body ?? {},
      query: request.query ?? {},
    };

    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}
