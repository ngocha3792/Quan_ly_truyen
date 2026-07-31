import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class SerializationException extends AppException {
  constructor(options: {
    code?: string;
    message?: string;
    target?: string;
    details?: ExceptionDetails;
    cause?: unknown;
  } = {}) {
    super({
      code: options.code ?? CommonExceptionCode.SERIALIZATION_ERROR,
      message: options.message ?? 'Không thể chuyển đổi dữ liệu',
      category: ExceptionCategory.INTERNAL,
      details: {
        ...(options.target ? { target: options.target } : {}),
        ...options.details,
      },
      cause: options.cause,
      expose: false,
    });
  }
}
