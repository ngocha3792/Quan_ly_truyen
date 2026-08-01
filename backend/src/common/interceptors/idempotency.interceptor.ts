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
import { from, Observable, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';

import { IDEMPOTENT_KEY, IDEMPOTENCY_STORE } from '@/common/constants';
import { MAX_IDEMPOTENCY_KEY_LENGTH } from '@/common/constants/http.constants';
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
    if (trimmedKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new InvalidInputException({
        message: `Idempotency key cannot exceed ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`,
      });
    }
    const ttlSeconds = metadata.ttlSeconds ?? 86_400;
    const requestHash = this.computeRequestHash(request);
    const storageKey = this.computeStorageKey(request, trimmedKey);

    const acquireResult = await this.idempotencyStore.acquire(
      storageKey,
      requestHash,
      ttlSeconds,
    );

    if (!acquireResult.acquired) {
      const existing = acquireResult.existingRecord;

      if (!existing || existing.state === 'PROCESSING') {
        throw new IdempotencyConflictException({
          key: storageKey,
          message: 'Yêu cầu trùng lặp đang được xử lý',
        });
      }

      if (existing.requestHash && existing.requestHash !== requestHash) {
        throw new IdempotencyConflictException({
          key: storageKey,
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
      mergeMap(async (body: unknown) => {
        const statusCode = response.statusCode || 200;
        await this.idempotencyStore.saveResult(
          storageKey,
          acquireResult.ownerToken,
          {
            statusCode,
            responseBody: body,
          },
          ttlSeconds,
        );
        return body;
      }),
      catchError((err: unknown) => {
        return from(
          this.idempotencyStore.markFailed(
            storageKey,
            acquireResult.ownerToken,
          ),
        ).pipe(mergeMap(() => throwError(() => err)));
      }),
    );
  }

  private computeRequestHash(request: Request): string {
    // Express deliberately types parsed body as any; it is serialized as opaque input here.

    const payload = {
      path: this.routeScope(request),
      method: request.method,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      body: request.body ?? {},
      query: request.query ?? {},
    };

    return createHash('sha256')
      .update(this.stableSerialize(payload))
      .digest('hex');
  }

  private computeStorageKey(request: Request, rawKey: string): string {
    const principalScope = this.resolvePrincipalScope(request.user);
    const rawKeyHash = createHash('sha256').update(rawKey).digest('hex');
    return [
      'idempotency:v1',
      principalScope,
      request.method.toUpperCase(),
      encodeURIComponent(this.routeScope(request)),
      rawKeyHash,
    ].join(':');
  }

  private routeScope(request: Request): string {
    const route = request.route as { path?: unknown } | undefined;
    if (typeof route?.path === 'string') {
      return `${request.baseUrl ?? ''}${route.path}`;
    }
    return `${request.baseUrl ?? ''}${request.path}`;
  }

  private resolvePrincipalScope(value: unknown): string {
    if (!value || typeof value !== 'object') return 'anonymous';
    const principal = value as Record<string, unknown>;
    if (typeof principal.userId === 'string' && principal.userId) {
      return principal.userId;
    }
    if (typeof principal.sub === 'string' && principal.sub) {
      return principal.sub;
    }
    return 'anonymous';
  }

  private stableSerialize(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableSerialize(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${this.stableSerialize(record[key])}`,
        )
        .join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
  }
}
