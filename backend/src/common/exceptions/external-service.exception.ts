import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class ExternalServiceException extends AppException {
  constructor(options: {
    code?: string;
    message?: string;
    service: string;
    operation?: string;
    upstreamStatus?: number;
    details?: ExceptionDetails;
    cause?: unknown;
    retryable?: boolean;
  }) {
    super({
      code: options.code ?? CommonExceptionCode.EXTERNAL_SERVICE_ERROR,
      message: options.message ?? `Dịch vụ ${options.service} phản hồi lỗi`,
      category: ExceptionCategory.BAD_GATEWAY,
      details: {
        service: options.service,
        ...(options.operation ? { operation: options.operation } : {}),
        ...(options.upstreamStatus !== undefined
          ? { upstreamStatus: options.upstreamStatus }
          : {}),
        ...options.details,
      },
      cause: options.cause,
      retryable: options.retryable ?? true,
      expose: false,
    });
  }
}
