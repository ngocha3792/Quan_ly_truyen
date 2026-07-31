import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class InvalidTokenException extends AppException {
  constructor(options: {
    code?: string;
    message?: string;
    details?: ExceptionDetails;
    cause?: unknown;
  } = {}) {
    super({
      code: options.code ?? CommonExceptionCode.INVALID_TOKEN,
      message: options.message ?? 'Token không hợp lệ',
      category: ExceptionCategory.UNAUTHORIZED,
      details: options.details,
      cause: options.cause,
    });
  }
}
