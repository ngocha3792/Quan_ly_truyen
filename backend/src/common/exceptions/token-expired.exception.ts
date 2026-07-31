import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class TokenExpiredException extends AppException {
  constructor(
    options: {
      message?: string;
      details?: ExceptionDetails;
      cause?: unknown;
    } = {},
  ) {
    super({
      code: CommonExceptionCode.TOKEN_EXPIRED,
      message: options.message ?? 'Token đã hết hạn',
      category: ExceptionCategory.UNAUTHORIZED,
      details: options.details,
      cause: options.cause,
    });
  }
}
