import { AppException, ExceptionDetails } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';

export class BusinessRuleViolationException extends AppException {
  constructor(options: {
    code?: string;
    message: string;
    rule?: string;
    details?: ExceptionDetails;
    cause?: unknown;
  }) {
    super({
      code: options.code ?? CommonExceptionCode.BUSINESS_RULE_VIOLATION,
      message: options.message,
      category: ExceptionCategory.UNPROCESSABLE_ENTITY,
      details: {
        ...(options.rule ? { rule: options.rule } : {}),
        ...options.details,
      },
      cause: options.cause,
    });
  }
}
