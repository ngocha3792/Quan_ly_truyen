import { createHash } from 'node:crypto';
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { from, Observable, of } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';

import { IDEMPOTENT_KEY, IDEMPOTENCY_STORE } from '@/common/constants';
import { MAX_IDEMPOTENCY_KEY_LENGTH } from '@/common/constants/http.constants';
import type { IdempotencyMetadata } from '@/common/decorators';
import {
  IdempotencyConflictException,
  InvalidInputException,
} from '@/common/exceptions';
import type { IdempotencyStore } from '@/infrastructure/idempotency';
import type { IdempotencyConfig } from '@/config';
import {
  MANUAL_SPANS,
  MetricsService,
  TracingService,
} from '@/infrastructure/observability';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private readonly processingLeaseTtlSeconds: number;

  constructor(
    private readonly reflector: Reflector,
    @Inject(IDEMPOTENCY_STORE)
    private readonly idempotencyStore: IdempotencyStore,
    private readonly metrics: MetricsService,
    private readonly tracing: TracingService,
    configService: ConfigService,
  ) {
    this.processingLeaseTtlSeconds =
      configService.get<IdempotencyConfig>('idempotency')
        ?.processingLeaseTtlSeconds ?? 120;
  }

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
    const processingLeaseTtlSeconds = Math.min(
      ttlSeconds,
      this.processingLeaseTtlSeconds,
    );
    const requestHash = this.computeRequestHash(request);
    const storageKey = this.computeStorageKey(request, trimmedKey);

    const acquireResult = await this.tracing.inSpan(
      MANUAL_SPANS.IDEMPOTENCY_ACQUIRE,
      { 'idempotency.system': 'application' },
      () =>
        this.idempotencyStore.acquire(
          storageKey,
          requestHash,
          processingLeaseTtlSeconds,
        ),
    );

    if (!acquireResult.acquired) {
      const existing = acquireResult.existingRecord;

      if (!existing || existing.state === 'PROCESSING') {
        this.metrics.recordIdempotency('acquire', 'conflict');
        throw new IdempotencyConflictException({
          key: storageKey,
          message: 'Yêu cầu trùng lặp đang được xử lý',
        });
      }

      if (existing.requestHash && existing.requestHash !== requestHash) {
        this.metrics.recordIdempotency('acquire', 'conflict');
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
      this.metrics.recordIdempotency('acquire', 'replay');
      return of(existing.responseBody);
    }
    this.metrics.recordIdempotency('acquire', 'success');

    const businessResult$ = next
      .handle()
      .pipe(
        catchError((businessError: unknown) =>
          from(
            this.releaseFailedBusinessLease(
              storageKey,
              acquireResult.ownerToken,
              businessError,
            ),
          ),
        ),
      );

    return businessResult$.pipe(
      mergeMap(async (body: unknown) => {
        const statusCode = response.statusCode || 200;
        try {
          await this.idempotencyStore.saveResult(
            storageKey,
            acquireResult.ownerToken,
            {
              statusCode,
              responseBody: body,
            },
            ttlSeconds,
          );
          this.metrics.recordIdempotency('save_result', 'success');
        } catch (error: unknown) {
          this.metrics.recordIdempotency('save_result', 'failed');
          this.logger.error({
            message:
              'Unable to persist idempotency result after business success',
            category:
              'idempotency-result-persist-failed-after-business-success',
            errorType: this.errorType(error),
            processingLeaseTtlSeconds,
          });

          /*
           * Business handler đã hoàn tất thành công và có thể đã commit DB.
           * Không được biến lỗi replay-store hậu commit thành HTTP 5xx giả.
           *
           * Cũng không markFailed ở đây: xóa lease ngay sẽ cho phép request
           * trùng lặp chạy lại trong lúc response đầu tiên đang được trả.
           * Lease PROCESSING tự hết hạn theo TTL ngắn riêng; sau đó client có
           * thể retry nếu response ban đầu thực sự bị mất.
           */
        }
        return body;
      }),
    );
  }

  private async releaseFailedBusinessLease(
    storageKey: string,
    ownerToken: string,
    businessError: unknown,
  ): Promise<never> {
    try {
      await this.idempotencyStore.markFailed(storageKey, ownerToken);
      this.metrics.recordIdempotency('mark_failed', 'success');
    } catch (cleanupError: unknown) {
      this.metrics.recordIdempotency('mark_failed', 'failed');
      this.logger.warn({
        message: 'Unable to release failed idempotency lease',
        category: 'idempotency-business-failure-cleanup-failed',
        errorType: this.errorType(cleanupError),
      });
    }

    throw businessError;
  }

  private errorType(error: unknown): string {
    return error instanceof Error ? error.name : typeof error;
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
