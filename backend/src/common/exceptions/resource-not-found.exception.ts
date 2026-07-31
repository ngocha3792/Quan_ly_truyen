import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export interface ResourceNotFoundExceptionOptions {
  code?: string;
  message?: string;
  resource: string;
  identifier?: unknown;
  details?: ExceptionDetails;
}

export class ResourceNotFoundException extends AppException {
  constructor(options: ResourceNotFoundExceptionOptions) {
    super({
      code: options.code ?? CommonExceptionCode.RESOURCE_NOT_FOUND,
      message: options.message ?? `Không tìm thấy ${options.resource}`,
      category: ExceptionCategory.NOT_FOUND,
      details: {
        resource: options.resource,
        ...(options.identifier !== undefined
          ? { identifier: options.identifier }
          : {}),
        ...options.details,
      },
    });
  }
}
