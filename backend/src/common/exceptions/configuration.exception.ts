import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class ConfigurationException extends AppException {
  constructor(options: {
    code?: string;
    message?: string;
    key?: string;
    details?: ExceptionDetails;
    cause?: unknown;
  } = {}) {
    super({
      code: options.code ?? CommonExceptionCode.CONFIGURATION_ERROR,
      message: options.message ?? 'Cấu hình hệ thống không hợp lệ',
      category: ExceptionCategory.INTERNAL,
      details: {
        ...(options.key ? { key: options.key } : {}),
        ...options.details,
      },
      cause: options.cause,
      expose: false,
    });
  }
}
