import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class AccessDeniedException extends AppException {
  constructor(
    options: {
      code?: string;
      message?: string;
      details?: ExceptionDetails;
    } = {},
  ) {
    super({
      code: options.code ?? CommonExceptionCode.ACCESS_DENIED,
      message: options.message ?? 'Bạn không có quyền thực hiện thao tác này',
      category: ExceptionCategory.FORBIDDEN,
      details: options.details,
    });
  }
}
