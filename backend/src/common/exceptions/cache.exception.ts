import { ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { InfrastructureException } from './infrastructure.exception';

export class CacheException extends InfrastructureException {
  constructor(options: {
    code?: string;
    message?: string;
    operation?: string;
    key?: string;
    details?: ExceptionDetails;
    cause?: unknown;
    retryable?: boolean;
  } = {}) {
    super({
      code: options.code ?? CommonExceptionCode.CACHE_ERROR,
      message: options.message ?? 'Không thể truy cập cache',
      component: 'cache',
      operation: options.operation,
      details: {
        ...(options.key ? { key: options.key } : {}),
        ...options.details,
      },
      cause: options.cause,
      retryable: options.retryable,
    });
  }
}
