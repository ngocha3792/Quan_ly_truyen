import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class AuthenticationRequiredException extends AppException {
  constructor(
    options: {
      code?: string;
      message?: string;
      details?: ExceptionDetails;
    } = {},
  ) {
    super({
      code: options.code ?? CommonExceptionCode.AUTHENTICATION_REQUIRED,
      message: options.message ?? 'Bạn cần đăng nhập để thực hiện thao tác này',
      category: ExceptionCategory.UNAUTHORIZED,
      details: options.details,
    });
  }
}
