import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class UnexpectedException extends AppException {
  constructor(options: {
    code?: string;
    message?: string;
    details?: ExceptionDetails;
    cause?: unknown;
  } = {}) {
    super({
      code: options.code ?? CommonExceptionCode.INTERNAL_ERROR,
      message: options.message ?? 'Hệ thống gặp lỗi không mong muốn',
      category: ExceptionCategory.INTERNAL,
      details: options.details,
      cause: options.cause,
      expose: false,
    });
  }
}
