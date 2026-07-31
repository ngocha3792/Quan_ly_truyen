import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class InvalidOperationException extends AppException {
  constructor(options: {
    code?: string;
    message?: string;
    operation?: string;
    details?: ExceptionDetails;
  } = {}) {
    super({
      code: options.code ?? CommonExceptionCode.INVALID_OPERATION,
      message: options.message ?? 'Không thể thực hiện thao tác ở trạng thái hiện tại',
      category: ExceptionCategory.CONFLICT,
      details: {
        ...(options.operation ? { operation: options.operation } : {}),
        ...options.details,
      },
    });
  }
}
