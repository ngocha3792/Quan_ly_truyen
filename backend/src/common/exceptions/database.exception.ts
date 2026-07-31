import { InfrastructureException } from './infrastructure.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionDetails } from './app.exception';

export class DatabaseException extends InfrastructureException {
  constructor(
    options: {
      code?: string;
      message?: string;
      operation?: string;
      details?: ExceptionDetails;
      cause?: unknown;
      retryable?: boolean;
    } = {},
  ) {
    super({
      code: options.code ?? CommonExceptionCode.DATABASE_ERROR,
      message: options.message ?? 'Không thể truy cập cơ sở dữ liệu',
      component: 'database',
      operation: options.operation,
      details: options.details,
      cause: options.cause,
      retryable: options.retryable,
    });
  }
}
