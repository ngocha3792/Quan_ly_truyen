import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class InvalidStateTransitionException extends AppException {
  constructor(options: {
    code?: string;
    message?: string;
    resource?: string;
    from: string;
    to: string;
    details?: ExceptionDetails;
  }) {
    super({
      code: options.code ?? CommonExceptionCode.INVALID_STATE_TRANSITION,
      message:
        options.message ??
        `Không thể chuyển trạng thái từ ${options.from} sang ${options.to}`,
      category: ExceptionCategory.CONFLICT,
      details: {
        ...(options.resource ? { resource: options.resource } : {}),
        from: options.from,
        to: options.to,
        ...options.details,
      },
    });
  }
}
