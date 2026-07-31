import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class RateLimitExceededException extends AppException {
  readonly retryAfterSeconds?: number;

  constructor(options: {
    code?: string;
    message?: string;
    retryAfterSeconds?: number;
    limit?: number;
    details?: ExceptionDetails;
  } = {}) {
    super({
      code: options.code ?? CommonExceptionCode.RATE_LIMIT_EXCEEDED,
      message: options.message ?? 'Bạn đã gửi quá nhiều yêu cầu',
      category: ExceptionCategory.TOO_MANY_REQUESTS,
      details: {
        ...(options.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: options.retryAfterSeconds }
          : {}),
        ...(options.limit !== undefined ? { limit: options.limit } : {}),
        ...options.details,
      },
      retryable: true,
    });

    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
