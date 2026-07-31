import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class ConcurrencyConflictException extends AppException {
  constructor(options: {
    code?: string;
    message?: string;
    resource?: string;
    identifier?: unknown;
    details?: ExceptionDetails;
    cause?: unknown;
    retryable?: boolean;
  } = {}) {
    super({
      code: options.code ?? CommonExceptionCode.CONCURRENCY_CONFLICT,
      message: options.message ?? 'Dữ liệu đã bị thay đổi bởi một tiến trình khác',
      category: ExceptionCategory.CONFLICT,
      details: {
        ...(options.resource ? { resource: options.resource } : {}),
        ...(options.identifier !== undefined
          ? { identifier: options.identifier }
          : {}),
        ...options.details,
      },
      cause: options.cause,
      retryable: options.retryable ?? true,
    });
  }
}
