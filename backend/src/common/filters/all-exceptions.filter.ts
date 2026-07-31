import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { ExceptionNormalizer } from './exception-normalizer';
import {
  ApiErrorResponse,
  NormalizedException,
} from './normalized-exception.interface';
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
  ) { }

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

    this.writeLog(exception, normalized, requestMetadata);

    httpAdapter.setHeader(
      response,
      'x-request-id',
      requestMetadata.requestId,
    );

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
        ...(exception.details
          ? { details: exception.details }
          : {}),
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
    const logMessage = [
      `${request.method} ${request.path}`,
      `status=${normalized.status}`,
      `code=${normalized.code}`,
      `requestId=${request.requestId}`,
      request.userId ? `userId=${request.userId}` : undefined,
    ]
      .filter(Boolean)
      .join(' ');

    if (normalized.logLevel === 'error') {
      const stack = exception instanceof Error
        ? exception.stack
        : undefined;

      this.logger.error(logMessage, stack);
      return;
    }

    this.logger.warn(logMessage);
  }
}
