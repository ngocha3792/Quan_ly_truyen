import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class ServiceUnavailableException extends AppException {
  constructor(options: {
    code?: string;
    message?: string;
    service?: string;
    retryAfterSeconds?: number;
    details?: ExceptionDetails;
    cause?: unknown;
  } = {}) {
    super({
      code: options.code ?? CommonExceptionCode.SERVICE_UNAVAILABLE,
      message: options.message ?? 'Dịch vụ tạm thời không khả dụng',
      category: ExceptionCategory.SERVICE_UNAVAILABLE,
      details: {
        ...(options.service ? { service: options.service } : {}),
        ...(options.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: options.retryAfterSeconds }
          : {}),
        ...options.details,
      },
      cause: options.cause,
      retryable: true,
      expose: false,
    });
  }
}
