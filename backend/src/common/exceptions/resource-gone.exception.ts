import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class ResourceGoneException extends AppException {
  constructor(options: {
    code?: string;
    message?: string;
    resource?: string;
    identifier?: unknown;
    details?: ExceptionDetails;
  } = {}) {
    super({
      code: options.code ?? CommonExceptionCode.RESOURCE_GONE,
      message: options.message ?? 'Tài nguyên không còn khả dụng',
      category: ExceptionCategory.GONE,
      details: {
        ...(options.resource ? { resource: options.resource } : {}),
        ...(options.identifier !== undefined
          ? { identifier: options.identifier }
          : {}),
        ...options.details,
      },
    });
  }
}
