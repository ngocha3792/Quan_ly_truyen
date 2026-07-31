import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export interface InvalidInputExceptionOptions {
  code?: string;
  message?: string;
  details?: ExceptionDetails;
  cause?: unknown;
}

export class InvalidInputException extends AppException {
  constructor(options: InvalidInputExceptionOptions = {}) {
    super({
      code: options.code ?? CommonExceptionCode.INVALID_INPUT,
      message: options.message ?? 'Dữ liệu đầu vào không hợp lệ',
      category: ExceptionCategory.BAD_REQUEST,
      details: options.details,
      cause: options.cause,
    });
  }
}
