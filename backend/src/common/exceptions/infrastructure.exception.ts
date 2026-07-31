import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class InfrastructureException extends AppException {
  constructor(
    options: {
      code?: string;
      message?: string;
      component?: string;
      operation?: string;
      details?: ExceptionDetails;
      cause?: unknown;
      retryable?: boolean;
    } = {},
  ) {
    super({
      code: options.code ?? CommonExceptionCode.INFRASTRUCTURE_ERROR,
      message: options.message ?? 'Hạ tầng hệ thống gặp sự cố',
      category: ExceptionCategory.SERVICE_UNAVAILABLE,
      details: {
        ...(options.component ? { component: options.component } : {}),
        ...(options.operation ? { operation: options.operation } : {}),
        ...options.details,
      },
      cause: options.cause,
      retryable: options.retryable ?? true,
      expose: false,
    });
  }
}
