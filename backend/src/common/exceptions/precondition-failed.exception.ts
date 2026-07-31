import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class PreconditionFailedException extends AppException {
  constructor(options: {
    code?: string;
    message?: string;
    details?: ExceptionDetails;
  } = {}) {
    super({
      code: options.code ?? CommonExceptionCode.PRECONDITION_FAILED,
      message: options.message ?? 'Điều kiện tiên quyết không được đáp ứng',
      category: ExceptionCategory.PRECONDITION_FAILED,
      details: options.details,
    });
  }
}
