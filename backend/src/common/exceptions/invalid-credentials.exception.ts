import { AppException } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class InvalidCredentialsException extends AppException {
  constructor(message = 'Email, tên đăng nhập hoặc mật khẩu không chính xác') {
    super({
      code: CommonExceptionCode.INVALID_CREDENTIALS,
      message,
      category: ExceptionCategory.UNAUTHORIZED,
    });
  }
}
