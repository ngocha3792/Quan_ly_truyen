import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class RequestTimeoutException extends AppException {
  constructor(options: {
    code?: string;
    message?: string;
    timeoutMs?: number;
    operation?: string;
    details?: ExceptionDetails;
    cause?: unknown;
  } = {}) {
    super({
      code: options.code ?? CommonExceptionCode.REQUEST_TIMEOUT,
      message: options.message ?? 'Yêu cầu xử lý quá thời gian cho phép',
      category: ExceptionCategory.REQUEST_TIMEOUT,
      details: {
        ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
        ...(options.operation ? { operation: options.operation } : {}),
        ...options.details,
      },
      cause: options.cause,
      retryable: true,
    });
  }
}
