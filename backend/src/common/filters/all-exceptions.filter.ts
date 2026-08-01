import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { context, SpanStatusCode, trace } from '@opentelemetry/api';

import type { ApiErrorResponse } from '@/common/interfaces/http';
import { sanitizeErrorForLog } from '@/common/utils';
import { resolveHttpRouteTemplate } from '@/infrastructure/observability/metrics';
import { ExceptionNormalizer } from './exception-normalizer';
import { NormalizedException } from './normalized-exception.interface';
import {
  extractRequestMetadata,
  HttpRequestLike,
  RequestMetadata,
} from './request-metadata.util';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly normalizer: ExceptionNormalizer,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const { httpAdapter } = this.adapterHost;

    if (!httpAdapter) {
      throw exception;
    }

    const httpContext = host.switchToHttp();
    const request = httpContext.getRequest<HttpRequestLike>();
    const response = httpContext.getResponse<unknown>();

    const requestMetadata = extractRequestMetadata(request);
    const normalized = this.normalizer.normalize(exception);
    const responseBody = this.buildResponse(normalized, requestMetadata);

    this.recordOnActiveSpan(exception, normalized);
    this.writeLog(exception, normalized, {
      ...requestMetadata,
      path: resolveHttpRouteTemplate(request),
    });

    httpAdapter.setHeader(response, 'x-request-id', requestMetadata.requestId);

    httpAdapter.reply(response, responseBody, normalized.status);
  }

  private buildResponse(
    exception: NormalizedException,
    request: RequestMetadata,
  ): ApiErrorResponse {
    return {
      success: false,
      error: {
        code: exception.code,
        message: exception.message,
        ...(exception.details ? { details: exception.details } : {}),
        retryable: exception.retryable,
      },
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
      path: request.path,
    };
  }

  private writeLog(
    exception: unknown,
    normalized: NormalizedException,
    request: RequestMetadata,
  ): void {
    const fields = {
      event: 'http.request.failed',
      'http.method': request.method,
      'http.route': request.path,
      'http.status_code': normalized.status,
      'error.code': normalized.code,
      requestId: request.requestId,
      ...(request.correlationId
        ? { correlationId: request.correlationId }
        : {}),
      ...(request.userId ? { userId: request.userId } : {}),
    };

    if (normalized.logLevel === 'error') {
      this.logger.error(fields, exception, sanitizeErrorForLog(exception));
      return;
    }

    this.logger.warn(fields);
  }

  private recordOnActiveSpan(
    exception: unknown,
    normalized: NormalizedException,
  ): void {
    const span = trace.getSpan(context.active());
    if (!span) return;
    if (exception instanceof Error) span.recordException(exception);
    span.setAttributes({
      'error.type': normalized.code,
      'http.response.status_code': normalized.status,
    });
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: normalized.code,
    });
  }
}
