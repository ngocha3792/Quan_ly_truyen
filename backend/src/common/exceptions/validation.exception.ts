import { AppException } from './app.exception';
import { CommonExceptionCode } from './common-exception-code.enum';
import { ExceptionCategory } from './exception-category.enum';
import { ValidationIssue } from './validation-issue.interface';

export interface ValidationExceptionOptions {
  code?: string;
  message?: string;
  issues: readonly ValidationIssue[];
  cause?: unknown;
}

export class ValidationException extends AppException {
  readonly issues: readonly ValidationIssue[];

  constructor(options: ValidationExceptionOptions) {
    super({
      code: options.code ?? CommonExceptionCode.VALIDATION_ERROR,
      message: options.message ?? 'Dữ liệu gửi lên không hợp lệ',
      category: ExceptionCategory.BAD_REQUEST,
      details: { issues: options.issues },
      cause: options.cause,
    });

    this.issues = options.issues;
  }
}
