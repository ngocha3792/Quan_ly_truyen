import { AppException } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class MissingPermissionException extends AppException {
  constructor(requiredPermissions: readonly string[]) {
    super({
      code: CommonExceptionCode.MISSING_PERMISSION,
      message: 'Tài khoản không có quyền cần thiết',
      category: ExceptionCategory.FORBIDDEN,
      details: { requiredPermissions },
    });
  }
}
