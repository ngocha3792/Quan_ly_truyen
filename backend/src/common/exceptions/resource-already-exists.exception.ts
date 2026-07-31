import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class ResourceAlreadyExistsException extends AppException {
  constructor(options: {
    code?: string;
    message?: string;
    resource: string;
    field?: string;
    value?: unknown;
    details?: ExceptionDetails;
    cause?: unknown;
  }) {
    super({
      code: options.code ?? CommonExceptionCode.RESOURCE_ALREADY_EXISTS,
      message: options.message ?? `${options.resource} đã tồn tại`,
      category: ExceptionCategory.CONFLICT,
      details: {
        resource: options.resource,
        ...(options.field ? { field: options.field } : {}),
        ...(options.value !== undefined ? { value: options.value } : {}),
        ...options.details,
      },
      cause: options.cause,
    });
  }
}
